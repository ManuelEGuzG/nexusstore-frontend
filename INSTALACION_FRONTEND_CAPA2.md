# NexusStore Frontend — Capa 2: POS + sincronización offline

El corazón del producto. POS con botones rápidos, monto libre, búsqueda,
carrito y cobro (efectivo/fiado/manual). Las ventas se guardan en el
navegador (IndexedDB) y se sincronizan solas, sin duplicar.

---

## 1. Dónde va cada archivo

| Archivo | Destino |
|---|---|
| `offlineDb.ts` | `src/services/offlineDb.ts` |
| `sync.ts` | `src/services/sync.ts` |
| `pos.ts` | `src/stores/pos.ts` |
| `PosView.vue` | `src/views/PosView.vue` (REEMPLAZA el placeholder) |
| `main.ts` | `src/main.ts` (REEMPLAZA: ahora arranca el auto-sync) |

El resto de la capa 1 queda igual.

---

## 2. Arrancar

Backend corriendo + frontend:

```powershell
cd C:\Users\braxf\nexusstore-frontend
npm run dev
```

Entrá, andá al POS desde el dashboard (o registrate, que te lleva directo).

---

## 3. Prueba normal (con internet)

1. Si cargaste productos antes (por API), aparecen como botones. Tocá uno:
   se agrega al carrito a la derecha.
2. Tocá "Monto libre", escribí 1500, Agregar: entra como ítem suelto.
3. Ajustá cantidades con + / − y mirá el total.
4. "Cobrar" → elegí "Efectivo". La venta se guarda y el carrito se limpia.
5. El chip de arriba debe decir "En línea" y NO debe quedar nada
   "por sincronizar" (se sincronizó al instante).

## 4. Prueba OFFLINE (la importante)

Esto demuestra la sección 4.1 de la spec: vender sin internet.

1. Abrí las DevTools del navegador (F12) → pestaña "Network" →
   cambiá "No throttling" a **"Offline"**.
   (O en la pestaña Application > Service Workers, o simplemente apagá el wifi.)
2. El chip de arriba debe cambiar a "Sin conexión".
3. Hacé 2 o 3 ventas igual. Funcionan normal y se van acumulando:
   el chip "N por sincronizar" sube.
4. Volvé a poner "No throttling" (online otra vez).
5. En segundos, el contador "por sincronizar" baja a 0 solo:
   las ventas se enviaron al backend automáticamente.
6. Verificá en el backend que las ventas llegaron:
   ```powershell
   curl.exe http://localhost:8000/api/sales -H "Accept: application/json" -H "Authorization: Bearer TU_TOKEN"
   ```

### Prueba de NO duplicación
Aunque el sync reintente una venta ya enviada, el backend la rechaza por
uuid_cliente repetido. Resultado: nunca hay ventas dobles, ni siquiera si
se cae la conexión justo al enviar.

---

## 5. Cómo funciona (resumen técnico)

- Cada venta genera un `uuid_cliente` con `crypto.randomUUID()` en el navegador.
- Se guarda en IndexedDB como "pendiente" ANTES de tocar la red.
- `sync.ts` recorre las pendientes y las manda al backend:
  - éxito → marca "sincronizada"
  - sin red → quedan pendientes, reintenta luego
- El auto-sync corre al volver la conexión (evento `online`) y cada 30s.
- Como el backend es idempotente, reenviar = seguro, nunca duplica.

---

## Pendiente para la capa 3
Las pantallas de Fiados, Caja, Productos y Reportes (siguen siendo placeholders).
