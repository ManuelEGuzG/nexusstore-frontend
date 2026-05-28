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

onMounted(async () => {
  await auth.cargarUsuario()
  try {
    const [ventas, deben] = await Promise.all([
      api.get('/reportes/ventas-dia'),
      api.get('/reportes/quien-me-debe'),
    ])
    totalDia.value = ventas.data.total_dia
    numVentas.value = ventas.data.numero_ventas
    porCobrar.value = deben.data.total_por_cobrar
  } catch { /* deja ceros */ } finally { cargando.value = false }
})

// icono: clave del set SVG (definido en el template)
const accesos = [
  { nombre: 'Punto de venta', ruta: 'pos', desc: 'Vender ahora', icono: 'pos', destacado: true },
  { nombre: 'Fiados', ruta: 'fiados', desc: 'Quién me debe', icono: 'fiados' },
  { nombre: 'Productos', ruta: 'productos', desc: 'Catálogo y stock', icono: 'productos' },
  { nombre: 'Reportes', ruta: 'reportes', desc: 'Ventas y análisis', icono: 'reportes' },
  { nombre: 'Historial', ruta: 'historial', desc: 'Ventas y anulaciones', icono: 'historial' },
  { nombre: 'Configuración', ruta: 'configuracion', desc: 'Usuarios y seguridad', icono: 'config' },
]

function fmt(n: number) { return '₡' + Number(n).toLocaleString('es-CR') }
function salir() { auth.cerrarSesion().then(() => router.push('/login')) }
</script>

<template>
  <div class="page dash">
    <header class="dash-top fade-up">
      <div class="saludo">
        <p class="hola">Hola, {{ auth.user?.nombre || '...' }}</p>
        <h1>{{ auth.store?.nombre || 'Mi tienda' }}</h1>
      </div>
      <button class="btn btn-ghost mini" @click="salir">Salir</button>
    </header>

    <section class="metrics fade-up" style="animation-delay:0.05s">
      <div class="metric metric-accent">
        <span class="m-label">Ventas de hoy</span>
        <span class="m-value">{{ cargando ? '—' : fmt(totalDia) }}</span>
        <span class="m-sub">{{ numVentas }} ventas</span>
      </div>
      <div class="metric">
        <span class="m-label">Por cobrar</span>
        <span class="m-value warn-text">{{ cargando ? '—' : fmt(porCobrar) }}</span>
        <span class="m-sub">fiado pendiente</span>
      </div>
    </section>

    <h2 class="seccion-titulo fade-up" style="animation-delay:0.1s">Accesos</h2>
    <section class="grid fade-up" style="animation-delay:0.12s">
      <button v-for="a in accesos" :key="a.ruta" class="tile" :class="{ destacado: a.destacado }" @click="router.push({ name: a.ruta })">
        <span class="tile-icono">
          <!-- Set de íconos SVG (línea limpia, sin emojis) -->
          <svg v-if="a.icono === 'pos'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <svg v-else-if="a.icono === 'fiados'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <svg v-else-if="a.icono === 'productos'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="M12 22.08V12"/></svg>
          <svg v-else-if="a.icono === 'reportes'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          <svg v-else-if="a.icono === 'historial'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
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
.dash-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--sp-5); gap: 1rem; }
.hola { color: var(--text-dim); font-size: var(--fs-sm); margin-bottom: 0.2rem; }
.saludo h1 { font-size: var(--fs-xl); }

.metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: var(--sp-5); }
.metric { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.4rem; display: flex; flex-direction: column; gap: 0.3rem; box-shadow: var(--shadow); }
.metric-accent { background: linear-gradient(150deg, rgba(184,255,60,0.10), var(--bg-card) 62%); border-color: rgba(184,255,60,0.28); }
.m-label { color: var(--text-dim); font-size: var(--fs-sm); }
.m-value { font-family: var(--font-display); font-size: var(--fs-2xl); font-weight: 800; line-height: 1; }
.m-sub { color: var(--text-faint); font-size: var(--fs-xs); }

.seccion-titulo { font-size: var(--fs-md); color: var(--text); margin-bottom: 1rem; font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 1rem; }
.tile {
  text-align: left; padding: 1.3rem; cursor: pointer; display: flex; flex-direction: column; gap: 1rem;
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
  transition: transform 0.12s ease, border-color 0.2s ease, background 0.2s ease;
  min-height: 138px; justify-content: space-between;
}
.tile:hover { transform: translateY(-3px); border-color: var(--accent); background: var(--bg-hover); }
.tile-icono { color: var(--accent); }
.tile-icono svg { width: 28px; height: 28px; display: block; }
.tile-text { display: flex; flex-direction: column; gap: 0.25rem; }
.tile-nombre { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-md); color: var(--text); }
/* Contraste arreglado: descripción legible sobre tarjeta oscura */
.tile-desc { color: var(--text-dim); font-size: var(--fs-sm); }

/* Tarjeta destacada (verde) — texto oscuro legible */
.tile.destacado { background: linear-gradient(140deg, var(--accent), var(--accent-press)); border-color: transparent; box-shadow: var(--shadow-accent); }
.tile.destacado .tile-icono { color: #11140a; }
.tile.destacado .tile-nombre { color: #11140a; }
.tile.destacado .tile-desc { color: #1d2b0a; }

@media (max-width: 480px) {
  .grid { grid-template-columns: 1fr 1fr; }
  .tile { min-height: 124px; padding: 1.1rem; gap: 0.8rem; }
  .tile-icono svg { width: 24px; height: 24px; }
}
</style>