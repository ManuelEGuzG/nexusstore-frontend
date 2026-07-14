<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'

const router = useRouter()
const auth = useAuthStore()

const totalDia = ref(0)
const numVentas = ref(0)
const porCobrar = ref(0)
const cargando = ref(true)

// Devuelve la fecha de hoy en formato YYYY-MM-DD según la hora LOCAL del
// dispositivo. OJO: new Date().toISOString() convierte a UTC, y como Costa
// Rica va detrás de UTC, en horas de la tarde/noche eso ya "adelanta" al
// día siguiente — por eso el backend no encontraba ventas de "hoy" y
// siempre mostraba cero.
function fechaLocalISO(d: Date = new Date()): string {
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

onMounted(async () => {
  await auth.cargarUsuario()
  try {
    // El backend no tiene /reportes/ventas-dia; usamos /analytics/resumen
    // acotado a hoy (desde = hasta = fecha actual) para obtener las
    // mismas cifras que necesita esta pantalla.
    const hoy = fechaLocalISO()
    const [ventas, deben] = await Promise.all([
      api.get('/analytics/resumen', { params: { desde: hoy, hasta: hoy } }),
      api.get('/reportes/quien-me-debe'),
    ])
    totalDia.value = ventas.data.total_vendido
    numVentas.value = ventas.data.numero_ventas
    porCobrar.value = deben.data.total_por_cobrar
  } catch {
    /* Mantiene valores en cero en caso de error de red */
  } finally {
    cargando.value = false
  }
})

const accesos = [
  { nombre: 'Punto de venta', ruta: 'pos', desc: 'Vender ahora', icono: 'pos', destacado: true },
  { nombre: 'Fiados', ruta: 'fiados', desc: 'Cuentas corrientes', icono: 'fiados' },
  { nombre: 'Productos', ruta: 'productos', desc: 'Catálogo e inventario', icono: 'productos' },
  { nombre: 'Reportes', ruta: 'reportes', desc: 'Balances y análisis', icono: 'reportes' },
  { nombre: 'Historial', ruta: 'historial', desc: 'Auditoría de ventas', icono: 'historial' },
  { nombre: 'Configuración', ruta: 'configuracion', desc: 'Seguridad y usuarios', icono: 'config' },
]

function fmt(n: number) {
  return (
    '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  )
}

function salir() {
  auth.cerrarSesion().then(() => router.push('/login'))
}
</script>

<template>
  <div class="page dash">
    <header class="dash-top fade-up">
      <div class="saludo">
        <p class="hola">Usuario: {{ auth.user?.nombre || '...' }}</p>
        <h1>{{ auth.store?.nombre || 'Panel de Control' }}</h1>
      </div>
      <button class="btn btn-ghost mini-btn" @click="salir">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16 17 21 12 16 7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Cerrar Sesión
      </button>
    </header>

    <section class="metrics fade-up" style="animation-delay: 0.05s">
      <div class="metric metric-accent">
        <span class="m-label">Ventas de hoy</span>
        <span class="m-value">{{ cargando ? '—' : fmt(totalDia) }}</span>
        <span class="m-sub">{{ numVentas }} transacciones liquidadas</span>
      </div>
      <div class="metric">
        <span class="m-label">Cartera de Cobros</span>
        <span class="m-value warn-text">{{ cargando ? '—' : fmt(porCobrar) }}</span>
        <span class="m-sub">Saldos pendientes en cuenta corriente</span>
      </div>
    </section>

    <h2 class="seccion-titulo fade-up" style="animation-delay: 0.1s">Módulos del Sistema</h2>
    <section class="grid fade-up" style="animation-delay: 0.12s">
      <button
        v-for="a in accesos"
        :key="a.ruta"
        class="tile"
        :class="{ destacado: a.destacado }"
        @click="router.push({ name: a.ruta })"
      >
        <span class="tile-icono">
          <svg
            v-if="a.icono === 'pos'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
            <path d="M6 21h12"></path>
          </svg>
          <svg
            v-else-if="a.icono === 'fiados'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <svg
            v-else-if="a.icono === 'productos'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path>
          </svg>
          <svg
            v-else-if="a.icono === 'reportes'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <svg
            v-else-if="a.icono === 'historial'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <svg
            v-else-if="a.icono === 'config'"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="3"></circle>
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
            ></path>
          </svg>
        </span>
        <span class="tile-text">
          <span class="tile-nombre">{{ a.nombre }}</span>
          <span class="tile-desc">{{ a.desc }}</span>
        </span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.page {
  padding: clamp(1rem, 3vw, 2rem);
  max-width: 1200px;
  margin: 0 auto;
}

.dash-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--sp-5, 2rem);
  gap: 1rem;
  flex-wrap: wrap;
}

.hola {
  color: #64748b;
  font-size: clamp(0.85rem, 2vw, 0.95rem);
  margin: 0 0 0.2rem 0;
  font-weight: 500;
}
.saludo h1 {
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;
}

.mini-btn {
  padding: 0.5rem 0.85rem;
  font-size: 0.82rem;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: all 0.2s;
}
.mini-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.25);
  color: #f87171;
}

/* Sección de Métricas Financieras con fondo adaptado */
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: var(--sp-5, 2rem);
}
.metric {
  background: #080a10; /* Superficie oscura sutil */
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius, 12px);
  padding: 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}
.metric:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.7);
}
.metric-accent {
  background: #080a10;
  border-color: rgba(180, 254, 47, 0.15); /* Verde Lima sutil */
}
.metric-accent:hover {
  border-color: rgba(180, 254, 47, 0.3);
}
.m-label {
  color: #64748b;
  font-size: var(--fs-sm, 0.82rem);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.m-value {
  font-size: clamp(1.6rem, 4vw, 2.1rem);
  font-weight: 700;
  line-height: 1.1;
  color: #ffffff;
  letter-spacing: -0.02em;
}
.metric-accent .m-value {
  color: #b4fe2f; /* Verde Lima Activo */
}
.warn-text {
  color: #fde047;
}
.m-sub {
  color: rgba(255, 255, 255, 0.35);
  font-size: var(--fs-xs, 0.78rem);
}

/* Grid de Módulos (Accesos) */
.seccion-titulo {
  font-size: clamp(0.95rem, 2.5vw, 1.1rem);
  color: #ffffff;
  margin-bottom: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
  gap: 1rem;
}
.tile {
  text-align: left;
  padding: 1.3rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #090b11; /* Consistencia tonal con los ítems del catálogo */
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius, 12px);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    background 0.2s ease,
    box-shadow 0.2s ease;
  min-height: 140px;
  justify-content: space-between;
}
.tile:hover {
  transform: translateY(-4px);
  border-color: #b4fe2f; /* Verde Lima al hacer Hover */
  background: #0e111a;
  box-shadow: 0 8px 24px rgba(180, 254, 47, 0.05);
}
.tile-icono {
  color: #b4fe2f; /* Iconos por defecto en Verde Lima */
}
.tile-icono svg {
  width: clamp(22px, 4vw, 26px);
  height: clamp(22px, 4vw, 26px);
  display: block;
}
.tile-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.tile-nombre {
  font-weight: 600;
  font-size: clamp(0.95rem, 2.5vw, 1.1rem);
  color: #ffffff;
}
.tile-desc {
  color: #64748b;
  font-size: 0.82rem;
}

/* Tarjeta Destacada Especial (POS) - Estilo exacto al botón primario de venta */
.tile.destacado {
  background: #b4fe2f;
  border-color: transparent;
  box-shadow: 0 8px 24px rgba(180, 254, 47, 0.2);
}
.tile.destacado:hover {
  background: #c2ff55;
  transform: translateY(-4px);
  box-shadow: 0 12px 28px rgba(180, 254, 47, 0.35);
}
.tile.destacado .tile-icono {
  color: #000000;
}
.tile.destacado .tile-nombre {
  color: #000000;
}
.tile.destacado .tile-desc {
  color: rgba(0, 0, 0, 0.75);
  font-weight: 500;
}

/* Animaciones Base */
.fade-up {
  opacity: 0;
  transform: translateY(6px);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slideUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Soporte Responsivo Móvil */
@media (max-width: 480px) {
  .dash-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .grid {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .tile {
    min-height: 126px;
    padding: 1rem;
    gap: 0.75rem;
    border-radius: 8px;
  }
  .metric {
    border-radius: 8px;
  }
  .tile-icono svg {
    width: 22px;
    height: 22px;
  }
}
</style>
