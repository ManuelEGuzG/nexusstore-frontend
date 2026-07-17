<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

// Igual que en el Dashboard: usamos hora LOCAL, no UTC, para evitar que
// en horas de la tarde/noche la fecha "hasta" quede adelantada un día
// respecto a Costa Rica y el rango termine excluyendo las ventas de hoy.
function fechaLocalISO(d: Date = new Date()): string {
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

function isoHace(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return fechaLocalISO(d)
}
const desde = ref(isoHace(30))
const hasta = ref(fechaLocalISO())

const cargando = ref(true)
const resumen = ref<any>(null)
const serieDia = ref<any[]>([])
const serieHora = ref<any[]>([])
const prod = ref<any>(null)
const fiado = ref<any>(null)

// ---------- Responsive: detecta pantallas angostas para ajustar alturas
// y opciones de las gráficas (menos "chrome" visual en celular) ----------
const esMobil = ref(window.matchMedia('(max-width: 767px)').matches)
let mediaQuery: MediaQueryList | null = null
function actualizarEsMobil(e: MediaQueryListEvent | MediaQueryList) {
  esMobil.value = e.matches
}
onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 767px)')
  mediaQuery.addEventListener('change', actualizarEsMobil)
})
onUnmounted(() => {
  mediaQuery?.removeEventListener('change', actualizarEsMobil)
})

// ---------- Panel de ayuda: explica qué significa cada dato de la vista ----------
const mostrarAyuda = ref(false)
const ayudaItems = [
  {
    titulo: 'Ventas Netas',
    texto:
      'Suma de todas las ventas completadas dentro del rango de fechas elegido, comparada contra el periodo inmediatamente anterior de igual duración.',
  },
  {
    titulo: 'Transacciones',
    texto:
      'Cantidad total de ventas realizadas y el monto promedio que deja cada una (ticket promedio).',
  },
  {
    titulo: 'Por Cobrar',
    texto:
      'Saldo pendiente de ventas fiadas (a crédito) que tus clientes todavía no te han pagado.',
  },
  {
    titulo: 'Evolución Diaria',
    texto:
      'Cuánto vendiste cada día del rango. Sirve para ver qué días se vende más y cuáles menos.',
  },
  {
    titulo: 'Margen de Utilidad',
    texto:
      'Porcentaje de ganancia estimado sobre el costo de lo vendido, junto con la ganancia en colones.',
  },
  {
    titulo: 'Top 10 Productos',
    texto: 'Los diez artículos que más se vendieron en el rango, ordenados por monto total.',
  },
  {
    titulo: 'Frecuencia Horaria',
    texto:
      'En qué horas del día se concentran las ventas. Útil para planear turnos y horarios de personal.',
  },
  {
    titulo: 'Inventario Crítico',
    texto: 'Productos cuyo stock está por agotarse y conviene reabastecer pronto.',
  },
  {
    titulo: 'Flujo de Crédito',
    texto:
      'Cuánto fiaste, cuánto te han abonado, y el balance neto de crédito otorgado en el periodo.',
  },
]

function fmt(n: number) {
  return (
    '₡' +
    Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  )
}
function fmtFecha(f: string) {
  return new Date(f).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' })
}

async function cargar() {
  cargando.value = true
  const params = { desde: desde.value, hasta: hasta.value }
  try {
    const [r, sd, sh, p, fi] = await Promise.all([
      api.get('/analytics/resumen', { params }),
      api.get('/analytics/ventas-dia', { params }),
      api.get('/analytics/ventas-hora', { params }),
      api.get('/analytics/productos', { params }),
      api.get('/analytics/fiado', { params }),
    ])
    resumen.value = r.data
    serieDia.value = sd.data
    serieHora.value = sh.data
    prod.value = p.data
    fiado.value = fi.data
  } catch {
    /* Gestión preventiva ante fallos de red */
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

const rangoActivo = ref(30)
function rango(dias: number) {
  rangoActivo.value = dias
  desde.value = isoHace(dias)
  hasta.value = fechaLocalISO()
  cargar()
}

// ---------- Top 10 productos más vendidos (el backend devuelve hasta 15) ----------
const top10Productos = computed(() => (prod.value?.mas_vendidos || []).slice(0, 10))
const maxMontoProducto = computed(() =>
  Math.max(1, ...top10Productos.value.map((p: any) => Number(p.monto))),
)

// ---------- ApexCharts: Evolución diaria (área con gradiente) ----------
const diaSeries = computed(() => [
  { name: 'Ventas', data: serieDia.value.map((d) => Number(d.total)) },
])
const diaAltura = computed(() => (esMobil.value ? 210 : 270))
const diaOptions = computed(() => ({
  chart: {
    type: 'area',
    toolbar: { show: !esMobil.value, tools: { download: false } },
    zoom: { enabled: !esMobil.value },
    background: 'transparent',
    foreColor: '#7c8aa5',
    fontFamily: 'inherit',
    animations: { easing: 'easeinout', speed: 450 },
  },
  colors: ['#a3e635'],
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.45,
      opacityTo: 0.02,
      stops: [0, 90, 100],
    },
  },
  markers: {
    size: 0,
    hover: { size: 6 },
    colors: ['#a3e635'],
    strokeColors: '#0b0e18',
    strokeWidth: 2,
  },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 3 },
  grid: {
    borderColor: 'rgba(255,255,255,0.06)',
    strokeDashArray: 4,
    padding: { left: 4, right: 4 },
  },
  xaxis: {
    categories: serieDia.value.map((d) => fmtFecha(d.dia)),
    labels: { style: { fontSize: '0.68rem' }, rotate: 0 },
    axisBorder: { show: false },
    axisTicks: { show: false },
    tooltip: { enabled: false },
  },
  yaxis: {
    labels: { formatter: (v: number) => fmt(v), style: { fontSize: '0.68rem' } },
  },
  tooltip: {
    theme: 'dark',
    x: { show: false },
    y: { formatter: (v: number) => fmt(v), title: { formatter: () => 'Ventas del día:' } },
    marker: { show: true },
  },
}))

// ---------- ApexCharts: Frecuencia horaria (barras horizontales) ----------
const horaSeries = computed(() => [
  { name: 'Ventas', data: serieHora.value.map((h) => Number(h.total)) },
])
const horaAltura = computed(() => (esMobil.value ? 230 : 280))
const horaOptions = computed(() => ({
  chart: {
    type: 'bar',
    toolbar: { show: false },
    background: 'transparent',
    foreColor: '#7c8aa5',
    fontFamily: 'inherit',
    animations: { easing: 'easeinout', speed: 450 },
  },
  plotOptions: {
    bar: { horizontal: true, borderRadius: 5, barHeight: '58%', distributed: false },
  },
  colors: ['#3b82f6'],
  fill: {
    type: 'gradient',
    gradient: {
      type: 'horizontal',
      shadeIntensity: 0.6,
      gradientToColors: ['#a3e635'],
      inverseColors: false,
      opacityFrom: 0.95,
      opacityTo: 0.95,
      stops: [0, 100],
    },
  },
  dataLabels: { enabled: false },
  grid: { borderColor: 'rgba(255,255,255,0.06)', strokeDashArray: 4 },
  xaxis: {
    categories: serieHora.value.map((h) => horaTxt(h.hora)),
    labels: { formatter: (v: number) => fmt(v), style: { fontSize: '0.65rem' } },
  },
  yaxis: { labels: { style: { fontSize: '0.7rem' } } },
  tooltip: {
    theme: 'dark',
    y: { formatter: (v: number) => fmt(v), title: { formatter: () => 'Vendido a las:' } },
  },
}))

// ---------- ApexCharts: Margen de utilidad (gauge radial) ----------
const gaugeSeries = computed(() => [
  Math.min(100, Math.max(0, Number(resumen.value?.margen_pct) || 0)),
])
const gaugeAltura = computed(() => (esMobil.value ? 170 : 200))
const gaugeOptions = computed(() => ({
  chart: {
    type: 'radialBar',
    sparkline: { enabled: true },
    background: 'transparent',
    fontFamily: 'inherit',
    animations: { easing: 'easeinout', speed: 600 },
  },
  colors: ['#a3e635'],
  stroke: { lineCap: 'round' },
  fill: {
    type: 'gradient',
    gradient: {
      shade: 'dark',
      type: 'diagonal1',
      shadeIntensity: 0.4,
      gradientToColors: ['#65d612'],
      stops: [0, 100],
    },
  },
  plotOptions: {
    radialBar: {
      hollow: { size: '65%' },
      track: { background: '#161b2c' },
      dataLabels: {
        name: {
          fontSize: '0.65rem',
          color: '#7c8aa5',
          offsetY: 18,
          formatter: () => 'Ganancia Estimada',
        },
        value: {
          fontSize: '1.05rem',
          color: '#ffffff',
          fontWeight: 700,
          offsetY: -14,
          formatter: () => fmt(resumen.value?.ganancia_estimada || 0),
        },
      },
    },
  },
}))

function exportarCsv() {
  const token = localStorage.getItem('nexus_token')
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
  const url = `${base}/reportes/exportar-ventas?desde=${desde.value}&hasta=${hasta.value}`
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `reporte_ventas_${desde.value}_to_${hasta.value}.csv`
      a.click()
    })
}

function horaTxt(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}
</script>

<template>
  <div class="wrap">
    <header class="top fade-up">
      <div class="top-row">
        <button class="btn-icon" @click="router.push('/')" aria-label="Volver al panel principal">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <div class="title-area">
          <span class="eyebrow">Analítica comercial</span>
          <h1>Resumen Operativo</h1>
        </div>
        <button
          class="btn-icon"
          :class="{ activo: mostrarAyuda }"
          @click="mostrarAyuda = !mostrarAyuda"
          aria-label="Explicar qué significa cada dato de esta vista"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </button>
        <button class="btn-primary" @click="exportarCsv" aria-label="Exportar reporte CSV">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span class="lbl-btn">Exportar</span>
        </button>
      </div>

      <transition name="ayuda-fade">
        <div v-if="mostrarAyuda" class="ayuda-panel card">
          <div class="ayuda-panel-head">
            <h3>¿Qué significa cada dato?</h3>
            <button
              class="btn-icon btn-cerrar-ayuda"
              @click="mostrarAyuda = false"
              aria-label="Cerrar ayuda"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="ayuda-grid">
            <div v-for="item in ayudaItems" :key="item.titulo" class="ayuda-item">
              <span class="ayuda-item-titulo">{{ item.titulo }}</span>
              <span class="ayuda-item-texto">{{ item.texto }}</span>
            </div>
          </div>
        </div>
      </transition>
    </header>

    <div class="filtros card fade-up" style="animation-delay: 0.05s">
      <div class="atajos">
        <button class="chip-btn" :class="{ activo: rangoActivo === 7 }" @click="rango(7)">
          7 Días
        </button>
        <button class="chip-btn" :class="{ activo: rangoActivo === 30 }" @click="rango(30)">
          Este Mes
        </button>
        <button class="chip-btn" :class="{ activo: rangoActivo === 90 }" @click="rango(90)">
          Trimestre
        </button>
      </div>
      <div class="fechas">
        <input type="date" v-model="desde" @change="cargar" aria-label="Fecha inicial" />
        <span class="flecha-intermedio">→</span>
        <input type="date" v-model="hasta" @change="cargar" aria-label="Fecha final" />
      </div>
    </div>

    <div v-if="cargando" class="loader-box">
      <div class="spinner"></div>
      <p class="dim loader-text">Procesando registros financieros comerciales…</p>
    </div>

    <template v-else>
      <section class="metricas fade-up" style="animation-delay: 0.1s">
        <div class="card met met-hero">
          <div class="met-header">
            <div class="met-icon-box ic-green">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
            <span
              v-if="resumen.variacion_pct !== null"
              class="delta-chip"
              :class="resumen.variacion_pct >= 0 ? 'up' : 'down'"
              >{{ resumen.variacion_pct >= 0 ? '+' : '' }}{{ resumen.variacion_pct }}%</span
            >
          </div>
          <span class="m-label">Ventas Netas</span>
          <span class="m-val">{{ fmt(resumen.total_vendido) }}</span>
          <span class="m-foot">vs. periodo anterior</span>
        </div>

        <div class="card met">
          <div class="met-header">
            <div class="met-icon-box ic-blue">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
          </div>
          <span class="m-label">Transacciones</span>
          <span class="m-val">{{ resumen.numero_ventas }}</span>
          <span class="m-foot"
            >Ticket promedio
            <strong class="txt-bright">{{ fmt(resumen.ticket_promedio) }}</strong></span
          >
        </div>

        <div class="card met">
          <div class="met-header">
            <div class="met-icon-box ic-warn">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
          </div>
          <span class="m-label">Por Cobrar</span>
          <span class="m-val warn">{{ fmt(fiado.total_por_cobrar) }}</span>
          <span class="m-foot"
            ><strong class="txt-bright">{{ fiado.top_deudores.length }}</strong> créditos
            vigentes</span
          >
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="card panel main-chart fade-up" style="animation-delay: 0.15s">
          <div class="panel-header">
            <h2>Evolución Diaria</h2>
            <span class="panel-tag">Ventas totales</span>
          </div>
          <div class="chart-container-dia">
            <apexchart
              v-if="serieDia.length"
              type="area"
              :height="diaAltura"
              :options="diaOptions"
              :series="diaSeries"
            />
            <p v-else class="dim vacío">Sin transacciones registradas.</p>
          </div>
        </section>

        <section class="card panel gauge-panel fade-up" style="animation-delay: 0.18s">
          <div class="panel-header">
            <h2>Margen de Utilidad</h2>
          </div>
          <div class="gauge-box">
            <div class="gauge-svg-wrap">
              <apexchart
                type="radialBar"
                :height="gaugeAltura"
                :options="gaugeOptions"
                :series="gaugeSeries"
              />
            </div>
            <div class="gauge-footer-metric">
              <span class="lbl">Rendimiento</span>
              <span class="val ok">{{ resumen.margen_pct }}%</span>
            </div>
          </div>
        </section>
      </div>

      <div class="details-grid">
        <section class="card panel fade-up" style="animation-delay: 0.2s">
          <div class="panel-header">
            <h2>Top 10 Productos Más Vendidos</h2>
          </div>
          <ol v-if="top10Productos.length" class="ranking">
            <li v-for="(p, i) in top10Productos" :key="p.descripcion" class="rk">
              <span class="rk-pos" :class="{ 'rk-pos-top': i === 0 }">{{ Number(i) + 1 }}</span>
              <div class="rk-body">
                <div class="rk-linea">
                  <span class="rk-desc" :title="p.descripcion">{{ p.descripcion }}</span>
                  <div class="rk-stats-box">
                    <span class="rk-cant"
                      >{{ Number(p.amount || p.cantidad).toLocaleString('es-CR') }} u.</span
                    >
                    <span class="rk-monto">{{ fmt(p.monto) }}</span>
                  </div>
                </div>
                <div class="rk-track">
                  <div
                    class="rk-fill"
                    :class="{ 'rk-fill-top': i === 0 }"
                    :style="{ width: (Number(p.monto) / maxMontoProducto) * 100 + '%' }"
                  ></div>
                </div>
              </div>
            </li>
          </ol>
          <p v-else class="dim vacío">Sin ventas en catálogo.</p>
        </section>

        <section class="card panel fade-up" style="animation-delay: 0.22s">
          <div class="panel-header">
            <h2>Frecuencia Horaria</h2>
          </div>
          <div v-if="serieHora.length" class="chart-hora">
            <apexchart
              type="bar"
              :height="horaAltura"
              :options="horaOptions"
              :series="horaSeries"
            />
          </div>
          <p v-else class="dim vacío">Métricas horarias insuficientes.</p>
        </section>

        <div class="vertical-subgrid">
          <section
            v-if="prod.stock_critico && prod.stock_critico.length"
            class="card panel alerta fade-up"
            style="animation-delay: 0.24s"
          >
            <div class="panel-header">
              <h2>Inventario Crítico</h2>
              <span class="badge-critico">Alerta</span>
            </div>
            <ul class="lista-simple">
              <li v-for="p in prod.stock_critico" :key="p.id">
                <span class="alerta-dot"></span>
                <span class="prod-nombre">{{ p.nombre }}</span>
                <span class="stock-num">Quedan {{ p.stock_actual }}</span>
              </li>
            </ul>
          </section>

          <section class="card panel fade-up" style="animation-delay: 0.26s">
            <div class="panel-header">
              <h2>Flujo de Crédito</h2>
            </div>
            <div class="fiado-cifras">
              <div class="fc">
                <span class="fc-lbl">Otorgado</span>
                <span class="fc-val warn">{{ fmt(fiado.fiado_otorgado) }}</span>
              </div>
              <div class="fc">
                <span class="fc-lbl">Abonos</span>
                <span class="fc-val ok">{{ fmt(fiado.abonos_recibidos) }}</span>
              </div>
              <div class="fc fc-total">
                <span class="fc-lbl">Balance</span>
                <span class="fc-val" :class="fiado.balance_periodo >= 0 ? 'ok' : 'warn'">{{
                  fmt(fiado.balance_periodo)
                }}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/*
  MOBILE-FIRST: todo lo que sigue está pensado primero para pantallas
  pequeñas (~360-400px de ancho). Los @media (min-width: ...) al final
  del archivo solo AÑADEN comportamiento para tablet/desktop, nunca
  lo corrigen — así evitamos el problema típico de diseñar para
  escritorio y "parchear" el celular después.
*/

* {
  box-sizing: border-box;
}

.wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0.75rem 0.75rem 3rem;
  padding-bottom: calc(3rem + env(safe-area-inset-bottom));
  width: 100%;
  font-feature-settings: 'tnum' 1;
  overflow-x: hidden;
}

/* ---------- Header ---------- */
.top {
  margin-bottom: 1.25rem;
  width: 100%;
}
.top-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.title-area {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.eyebrow {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent, #a3e635);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.top h1 {
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-icon,
.btn-primary,
.chip-btn {
  font-family: inherit;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}
.btn-icon {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  color: #94a3b8;
}
.btn-icon:active {
  transform: scale(0.94);
}
.btn-primary {
  height: 40px;
  padding: 0 0.85rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 10px;
  border: 1px solid var(--accent, #a3e635);
  background: rgba(163, 230, 53, 0.1);
  color: var(--accent, #a3e635);
  font-size: 0.8rem;
  font-weight: 700;
  flex-shrink: 0;
  white-space: nowrap;
}
.btn-primary:active {
  transform: scale(0.96);
  background: var(--accent, #a3e635);
  color: #0b1206;
}

@media (hover: hover) {
  .btn-icon:hover {
    border-color: var(--accent, #a3e635);
    color: #ffffff;
    background: rgba(255, 255, 255, 0.06);
  }
  .btn-primary:hover {
    background: var(--accent, #a3e635);
    color: #0b1206;
    box-shadow: 0 4px 16px -4px rgba(163, 230, 53, 0.45);
  }
}

/* ---------- Panel de ayuda ---------- */
.btn-icon.activo {
  border-color: var(--accent, #a3e635);
  color: var(--accent, #a3e635);
  background: rgba(163, 230, 53, 0.1);
}
.ayuda-panel {
  margin-top: 0.75rem;
  padding: 1rem;
}
.ayuda-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
}
.ayuda-panel-head h3 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: #ffffff;
}
.btn-cerrar-ayuda {
  width: 30px;
  height: 30px;
}
.ayuda-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
.ayuda-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.65rem 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 9px;
}
.ayuda-item-titulo {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--accent, #a3e635);
}
.ayuda-item-texto {
  font-size: 0.76rem;
  color: #9aa8c2;
  line-height: 1.45;
}
.ayuda-fade-enter-active,
.ayuda-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.ayuda-fade-enter-from,
.ayuda-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* En pantallas muy angostas, el botón de exportar se reduce a solo ícono */
@media (max-width: 374px) {
  .lbl-btn {
    display: none;
  }
  .btn-primary {
    width: 40px;
    padding: 0;
    justify-content: center;
  }
}

/* ---------- Card base ---------- */
.card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0) 40%),
    var(--bg-card, #111422);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.07));
  border-radius: var(--radius-sm, 14px);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.2),
    0 12px 24px -18px rgba(0, 0, 0, 0.6);
}

/* ---------- Filtros ---------- */
.filtros {
  padding: 0.75rem;
  margin-bottom: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.atajos {
  display: flex;
  gap: 0.4rem;
  width: 100%;
}
.chip-btn {
  flex: 1;
  min-height: 40px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.07);
  color: #cbd5e1;
  padding: 0.5rem 0.2rem;
  border-radius: 8px;
  font-size: 0.74rem;
  font-weight: 600;
}
.chip-btn.activo {
  background: rgba(163, 230, 53, 0.12);
  color: var(--accent, #a3e635);
  border-color: rgba(163, 230, 53, 0.45);
}
@media (hover: hover) {
  .chip-btn:hover {
    background: rgba(163, 230, 53, 0.08);
    color: var(--accent, #a3e635);
    border-color: rgba(163, 230, 53, 0.4);
  }
}
.fechas {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
}
.fechas input {
  flex: 1;
  min-width: 0;
  min-height: 40px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  padding: 0.5rem 0.35rem;
  color: #ffffff;
  font-size: 0.8rem;
  text-align: center;
  font-family: inherit;
  transition: border-color 0.15s ease;
  /* evita que iOS/Android agranden el input y rompan el layout */
  -webkit-appearance: none;
  appearance: none;
}
.fechas input:focus {
  outline: none;
  border-color: var(--accent, #a3e635);
}
.flecha-intermedio {
  flex-shrink: 0;
  color: #475569;
  font-size: 0.85rem;
}

/* ---------- Métricas ---------- */
.metricas {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.7rem;
  margin-bottom: 1.1rem;
}
.met {
  padding: 1.05rem;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.met-hero {
  border-color: rgba(163, 230, 53, 0.25);
  background:
    linear-gradient(160deg, rgba(163, 230, 53, 0.07), rgba(17, 20, 34, 0) 55%),
    var(--bg-card, #111422);
}
.met-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}
.met-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ic-green {
  background: rgba(163, 230, 53, 0.12);
  color: var(--accent, #a3e635);
}
.ic-blue {
  background: rgba(59, 130, 246, 0.14);
  color: #60a5fa;
}
.ic-warn {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.m-label {
  color: #7c8aa5;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.25rem;
}
.m-val {
  font-size: clamp(1.25rem, 6vw, 1.5rem);
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.02em;
  line-height: 1.15;
  word-break: break-word;
}
.m-val.warn {
  color: #fbbf24;
}
.m-foot {
  margin-top: 0.45rem;
  color: #7c8aa5;
  font-size: 0.74rem;
  line-height: 1.4;
}
.txt-bright {
  color: #e2e8f0;
  font-weight: 700;
}

.delta-chip {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 100px;
  flex-shrink: 0;
}
.delta-chip.up {
  background: rgba(163, 230, 53, 0.14);
  color: var(--accent, #a3e635);
}
.delta-chip.down {
  background: rgba(239, 68, 68, 0.14);
  color: #f87171;
}

/* ---------- Grids ---------- */
.dashboard-grid,
.details-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
  margin-bottom: 0.85rem;
}
.panel {
  padding: 1.05rem;
  min-width: 0;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.panel h2 {
  font-size: 0.8rem;
  margin: 0;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: 0.01em;
}
.panel-tag {
  font-size: 0.65rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.04);
  padding: 0.22rem 0.5rem;
  border-radius: 100px;
  color: #7c8aa5;
  border: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
  white-space: nowrap;
}

/* ---------- Chart: evolución diaria ---------- */
.chart-container-dia {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 0.5rem;
  margin: 0 -0.2rem;
  padding-left: 0.2rem;
  padding-right: 0.2rem;
}
.chart-container-dia::-webkit-scrollbar {
  height: 4px;
}
.chart-container-dia::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

/* ---------- Gauge ---------- */
.gauge-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.gauge-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
.gauge-svg-wrap {
  position: relative;
  width: 100%;
  max-width: 190px;
}
.gauge-footer-metric {
  margin-top: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.45rem 1rem;
  border-radius: 100px;
  font-size: 0.76rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
}
.gauge-footer-metric .lbl {
  color: #7c8aa5;
}
.gauge-footer-metric .val {
  font-weight: 700;
}

/* ---------- Ranking productos ---------- */
.ranking {
  list-style: none;
  padding: 0;
  margin: 0;
}
.rk {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.rk:last-child {
  border-bottom: none;
}
.rk-pos {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.04);
  color: #7c8aa5;
  font-size: 0.7rem;
  font-weight: 700;
  margin-top: 0.05rem;
}
.rk-pos-top {
  background: rgba(163, 230, 53, 0.15);
  color: var(--accent, #a3e635);
}
.rk-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.rk-linea {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.rk-desc {
  flex: 1;
  min-width: 0;
  font-size: 0.82rem;
  color: #cbd5e1;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
.rk-stats-box {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}
.rk-cant {
  color: #7c8aa5;
  font-size: 0.68rem;
  white-space: nowrap;
}
.rk-monto {
  font-size: 0.82rem;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
}
.rk-track {
  width: 100%;
  height: 5px;
  border-radius: 100px;
  background: rgba(255, 255, 255, 0.05);
  overflow: hidden;
}
.rk-fill {
  height: 100%;
  border-radius: 100px;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  transition: width 0.4s ease;
}
.rk-fill-top {
  background: linear-gradient(90deg, var(--accent, #a3e635), #d9ff8a);
}

/* ---------- Inventario crítico ---------- */
.badge-critico {
  background: rgba(239, 68, 68, 0.14);
  color: #f87171;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.2rem 0.5rem;
  border-radius: 100px;
  flex-shrink: 0;
}
.lista-simple {
  list-style: none;
  padding: 0;
  margin: 0;
}
.lista-simple li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 0.82rem;
}
.lista-simple li:last-child {
  border-bottom: none;
}
.alerta-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f87171;
  box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.15);
}
.prod-nombre {
  flex: 1;
  min-width: 0;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  color: #e2e8f0;
}
.stock-num {
  flex-shrink: 0;
  color: #f87171;
  font-weight: 700;
  font-size: 0.75rem;
  white-space: nowrap;
}

/* ---------- Flujo de crédito ---------- */
.fiado-cifras {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.fc {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 9px;
  padding: 0.65rem 0.8rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}
.fc-total {
  background: rgba(163, 230, 53, 0.05);
  border-color: rgba(163, 230, 53, 0.2);
}
.fc-lbl {
  color: #7c8aa5;
  font-size: 0.74rem;
  font-weight: 500;
}
.fc-val {
  font-weight: 700;
  font-size: 0.85rem;
  white-space: nowrap;
}

.vertical-subgrid {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

/* ---------- Utilidades ---------- */
.ok {
  color: var(--accent, #a3e635);
}
.warn {
  color: #f59e0b;
}
.dim {
  color: #7c8aa5;
}
.vacío {
  text-align: center;
  padding: 2rem 0;
  font-size: 0.8rem;
  color: #7c8aa5;
}

/* ---------- Loader ---------- */
.loader-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 1rem;
  text-align: center;
}
.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(59, 130, 246, 0.2);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 0.75rem;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-up {
  opacity: 0;
  transform: translateY(4px);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slideUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .fade-up {
    animation: none;
    opacity: 1;
    transform: none;
  }
}

/* =========================================================
   A partir de aquí solo AÑADIMOS layout para pantallas más
   grandes (tablet / escritorio). Nada aquí es necesario para
   que el celular se vea bien — el celular ya quedó resuelto arriba.
   ========================================================= */

@media (min-width: 480px) {
  .wrap {
    padding: 1rem 1rem 3.5rem;
  }
  .filtros {
    flex-direction: row;
    align-items: center;
    padding: 0.85rem;
  }
  .atajos,
  .fechas {
    width: auto;
  }
  .atajos {
    flex: 1;
  }
  .fechas input {
    width: 130px;
  }
  .top h1 {
    font-size: 1.3rem;
  }
  .ayuda-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 768px) {
  .wrap {
    padding: 1.5rem 1.25rem 4rem;
  }
  .top h1 {
    font-size: 1.5rem;
  }
  .metricas {
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  .dashboard-grid {
    grid-template-columns: 2fr 1fr;
    gap: 1.25rem;
  }
  .dashboard-grid,
  .details-grid {
    margin-bottom: 1.25rem;
  }
  .card:hover {
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.2),
      0 16px 32px -16px rgba(0, 0, 0, 0.7);
  }
  .ayuda-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1024px) {
  .details-grid {
    grid-template-columns: 1.2fr 1fr 1fr;
    gap: 1.25rem;
  }
  .met:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.2),
      0 16px 32px -16px rgba(0, 0, 0, 0.7);
  }
}
</style>
