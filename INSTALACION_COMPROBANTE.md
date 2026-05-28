# NexusStore — Comprobante de venta (tiquete + PDF)

Dos piezas:
1. Tiquete rápido en pantalla (frontend, funciona OFFLINE, se comparte).
2. PDF formal opcional (backend, para algo más serio).

================================================================
PARTE A — TIQUETE EN PANTALLA (frontend)
================================================================

## A.1 Dónde va

| Archivo | Destino |
|---|---|
| `ComprobanteTiquete.vue` | `src/components/ComprobanteTiquete.vue` |

## A.2 Conectarlo al POS

Hay que hacer 3 cambios pequeños en archivos que ya tenés:

### En `src/stores/pos.ts`
La función `finalizar` ya devuelve el `uuid`. Necesitamos también guardar
los datos de la última venta para mostrarlos en el tiquete. Reemplazá la
función `finalizar` por esta versión (agrega `ultimaVenta`):

```ts
  const ultimaVenta = ref<any>(null)

  async function finalizar(opciones: {
    tipoPago: TipoPago
    customerId?: number | null
  }): Promise<string> {
    const uuid = crypto.randomUUID()
    const itemsSnapshot = items.value.map((it) => ({ ...it }))
    const totalSnapshot = total.value

    const payload = {
      uuid_cliente: uuid,
      estado: 'completada',
      customer_id: opciones.customerId ?? null,
      items: itemsSnapshot,
      payments: [{ tipo: opciones.tipoPago, monto: totalSnapshot }],
    }

    await guardarVenta({
      uuid_cliente: uuid,
      payload,
      estado: 'pendiente',
      creada_en: Date.now(),
      intentos: 0,
    })

    // Guardamos snapshot para el tiquete
    ultimaVenta.value = {
      uuid,
      items: itemsSnapshot,
      total: totalSnapshot,
      formaPago: opciones.tipoPago,
      fecha: new Date().toISOString(),
    }

    limpiar()
    await sincronizarPendientes()
    await refrescarPendientes()
    return uuid
  }
```

Y agregá `ultimaVenta` al `return` del store (junto a los demás):
```ts
  return {
    items, pendientes, total, vacio, ultimaVenta,
    agregarProducto, agregarMontoLibre, cambiarCantidad,
    quitar, limpiar, finalizar, refrescarPendientes,
  }
```

### En `src/views/PosView.vue`
1. Importá el componente (en el <script setup>):
```ts
import ComprobanteTiquete from '@/components/ComprobanteTiquete.vue'
```

2. Agregá una variable para mostrarlo:
```ts
const mostrarTiquete = ref(false)
```

3. En la función `cobrar`, después de `pos.finalizar(...)`, mostrá el tiquete
   en vez de solo cerrar el modal:
```ts
async function cobrar(tipo: 'efectivo' | 'fiado' | 'manual') {
  if (tipo === 'fiado' && !clienteSeleccionado.value) {
    alert('Seleccioná un cliente para el fiado.')
    return
  }
  procesando.value = true
  try {
    await pos.finalizar({
      tipoPago: tipo,
      customerId: tipo === 'fiado' ? clienteSeleccionado.value : null,
    })
    mostrarPago.value = false
    clienteSeleccionado.value = null
    mostrarTiquete.value = true   // <-- NUEVO: muestra el comprobante
  } finally {
    procesando.value = false
  }
}
```

4. Antes de cerrar el </template>, agregá el componente:
```vue
    <ComprobanteTiquete
      v-if="mostrarTiquete && pos.ultimaVenta"
      :uuid="pos.ultimaVenta.uuid"
      :items="pos.ultimaVenta.items"
      :total="pos.ultimaVenta.total"
      :forma-pago="pos.ultimaVenta.formaPago"
      :fecha="pos.ultimaVenta.fecha"
      @cerrar="mostrarTiquete = false"
    />
```

## A.3 Probar
Hacé una venta y cobrá. Al cobrar aparece el tiquete con el detalle,
el total y un botón "Compartir" (usa el menú de compartir del teléfono,
o copia el texto en computadora). Funciona aunque estés offline.

================================================================
PARTE B — PDF FORMAL (backend)
================================================================

## B.1 Instalar la librería

```powershell
cd C:\Users\braxf\nexusstore-backend
composer require barryvdh/laravel-dompdf
```

(En Laravel 10 el service provider se autodescubre, no hay que registrarlo.)

## B.2 Dónde va cada archivo

| Archivo | Destino |
|---|---|
| `ComprobanteController.php` | `app/Http/Controllers/Api/ComprobanteController.php` |
| `comprobante.blade.php` | `resources/views/comprobante.blade.php` |

## B.3 Agregar la ruta

En `routes/api.php`, dentro del grupo protegido (junto a las otras de /sales):

```php
use App\Http\Controllers\Api\ComprobanteController;

// ... dentro del Route::middleware(['auth:sanctum', 'store.context'])->group(...)
Route::get('/sales/{sale}/comprobante', [ComprobanteController::class, 'pdf']);
```

## B.4 Probar
Necesitás el ID de una venta existente (de /api/sales). Abrí en el navegador
(estando logueado no sirve directo por el token; probalo con curl):

```powershell
curl.exe http://localhost:8000/api/sales/1/comprobante -o comprobante.pdf -H "Authorization: Bearer TU_TOKEN"
```

Se descarga `comprobante.pdf` con el formato formal A4.

### Opcional: botón en el frontend
En la pantalla de historial/reportes podés agregar un botón que abra:
`GET /api/sales/{id}/comprobante` con el token (igual que el export CSV
que ya hicimos con fetch + blob).

================================================================

## Resumen
- Tiquete en pantalla: instantáneo, offline, para el día a día.
- PDF formal: bajo demanda, cuando el cliente quiere algo "oficial".
