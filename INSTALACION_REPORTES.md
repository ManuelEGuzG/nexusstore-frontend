# NexusStore — Reportes y análisis avanzados

Agrega 6 grupos de análisis: resumen con ganancia/margen/ticket y
comparación vs periodo anterior, tendencia por día, horas pico,
productos (top + no rotan + stock crítico), fiado (otorgado/abonado/
antigüedad/top deudores) y caja (historial de cierres + diferencias).

================================================================
BACKEND
================================================================

## 1. Archivo
| Archivo | Destino |
|---|---|
| `AnalyticsController.php` | `app/Http/Controllers/Api/AnalyticsController.php` |

## 2. Rutas
Agregá las rutas de `rutas_a_agregar.txt` en `routes/api.php`,
dentro del grupo protegido. Luego:

```powershell
cd C:\Users\braxf\nexusstore-backend
php artisan route:clear
```

## 3. IMPORTANTE para que la GANANCIA funcione
El reporte de ganancia/margen usa el campo `costo` de cada producto.
Si tus productos no tienen costo cargado, la ganancia saldrá en 0.
Cargá el costo editando productos (o al crearlos). El reporte calcula:
   ganancia = (precio_venta − costo) × cantidad − descuento
solo sobre los ítems de productos catalogados que tengan costo.
Las ventas por monto libre no cuentan para ganancia (no tienen costo).

================================================================
FRONTEND
================================================================

## 4. Archivo
| Archivo | Destino |
|---|---|
| `ReportesView.vue` | `src/views/ReportesView.vue` (REEMPLAZA) |

No requiere librerías nuevas: los gráficos son SVG/CSS puro.

================================================================
PROBAR
================================================================

1. npm run dev (frontend) + backend corriendo.
2. Entrá a Reportes desde el dashboard.
3. Arriba: atajos de 7/30/90 días o elegí fechas exactas.
4. Vas a ver:
   - 4 tarjetas: vendido (con variación vs periodo anterior),
     ganancia estimada + margen, n° ventas + ticket promedio, por cobrar.
   - Gráfico de barras: ventas por día.
   - Barras horizontales: horas pico (cuándo vendés más).
   - Ranking de productos más vendidos.
   - Stock crítico (si definiste umbral en la tienda).
   - Productos que no rotaron en el periodo.
   - Fiado: otorgado vs abonado, balance, y deuda más antigua.
   - Caja: n° de cierres, faltantes/sobrantes y diferencia acumulada.
5. CSV: el botón de arriba exporta las ventas del rango elegido.

NOTA: con pocos datos de prueba, algunos paneles se verán vacíos o
flacos. Cobran sentido a medida que se acumulan ventas reales.

================================================================
Los 3 reportes viejos (ReportController) pueden quedarse o no;
esta pantalla nueva ya cubre y amplía todo lo que hacían.
