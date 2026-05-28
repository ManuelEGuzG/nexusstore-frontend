# NexusStore Frontend — Capa 3: Pantallas de gestión

Completa el MVP visible: Fiados, Caja, Productos y Reportes.
Las cuatro consumen los endpoints del backend que ya construimos.

---

## 1. Dónde va cada archivo

Las cuatro REEMPLAZAN los placeholders de la capa 1:

| Archivo | Destino |
|---|---|
| `FiadosView.vue` | `src/views/FiadosView.vue` |
| `CajaView.vue` | `src/views/CajaView.vue` |
| `ProductosView.vue` | `src/views/ProductosView.vue` |
| `ReportesView.vue` | `src/views/ReportesView.vue` |

No hay cambios en services, stores ni router. Solo reemplazás 4 vistas.

---

## 2. Probar cada pantalla

Con backend + frontend corriendo (`npm run dev`), desde el dashboard:

### Productos
1. Entrá a "Productos" → "+ Producto".
2. Creá: nombre "Coca Cola", precio 1000, stock 24. Guardar.
3. Aparece en la lista. Tocalo para editar; la × lo elimina.
4. Ahora esos productos aparecen como botones rápidos en el POS.

### Fiados
1. Entrá a "Fiados" → "+ Cliente" → creá "Doña Ana".
2. (Para ver saldo: andá al POS, vendé algo y cobralo a fiado a Doña Ana.)
3. Volvé a Fiados: Doña Ana aparece con su saldo. El total por cobrar arriba.
4. Tocá su nombre: ves el historial. Registrá un abono y mirá cómo baja el saldo.

### Caja
1. Entrá a "Caja" → "Abrir caja" con monto inicial (ej: 10000).
2. Hacé algunas ventas en efectivo desde el POS.
3. Volvé a Caja → escribí el efectivo contado → "Cerrar caja".
4. Te muestra esperado vs contado, la diferencia (sobra/falta) y el
   resumen del periodo con desglose por forma de pago.

### Reportes
1. Entrá a "Reportes": ves ventas de hoy, mini-gráfico de 7 días y
   ranking de productos más vendidos.
2. "Exportar CSV" descarga el archivo de ventas (se abre bien en Excel).

---

## Estado del MVP tras esta capa

Funcional de punta a punta:
- Registro/login y "primera venta en 60s" ✓
- POS con botones, monto libre, búsqueda ✓
- Ventas offline con sincronización sin duplicar ✓
- Fiado: clientes, consumo, abonos, quién me debe ✓
- Caja: apertura, cierre, arqueo ✓
- Productos y stock ✓
- 3 reportes + export CSV ✓

## Lo que queda (toque final, opcional)
- Convertir en PWA instalable (service worker + manifest con vite-plugin-pwa).
- Comprobante de venta en PDF.
- 2FA opcional del dueño (TOTP).
- Despliegue en DigitalOcean.
