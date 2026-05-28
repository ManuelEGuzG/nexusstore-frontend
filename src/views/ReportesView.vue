<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

// Rango de fechas (por defecto, últimos 30 días)
function isoHace(dias: number) {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}
const desde = ref(isoHace(30))
const hasta = ref(new Date().toISOString().slice(0, 10))

const cargando = ref(true)
const resumen = ref<any>(null)
const serieDia = ref<any[]>([])
const serieHora = ref<any[]>([])
const prod = ref<any>(null)
const fiado = ref<any>(null)

function fmt(n: number) {
  return '₡' + Number(n || 0).toLocaleString('es-CR')
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
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

// Atajos de rango
function rango(dias: number) {
  desde.value = isoHace(dias)
  hasta.value = new Date().toISOString().slice(0, 10)
  cargar()
}

// Máximos para escalar los gráficos
const maxDia = computed(() =>
  Math.max(1, ...serieDia.value.map((d) => Number(d.total))),
)
const maxHora = computed(() =>
  Math.max(1, ...serieHora.value.map((h) => Number(h.total))),
)

function exportarCsv() {
  const token = localStorage.getItem('nexus_token')
  const base = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
  const url = `${base}/reportes/exportar-ventas?desde=${desde.value}&hasta=${hasta.value}`
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.blob())
    .then((blob) => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `ventas_${desde.value}_${hasta.value}.csv`
      a.click()
    })
}

function horaTxt(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}
</script>

<template>
  <div class="wrap">
    <header class="top">
      <button class="btn btn-ghost mini" @click="router.push('/')">←</button>
      <h1>Reportes</h1>
      <button class="btn btn-ghost mini" @click="exportarCsv">CSV</button>
    </header>

    <!-- Selector de fechas -->
    <div class="filtros card">
      <div class="atajos">
        <button class="chip-btn" @click="rango(7)">7 días</button>
        <button class="chip-btn" @click="rango(30)">30 días</button>
        <button class="chip-btn" @click="rango(90)">90 días</button>
      </div>
      <div class="fechas">
        <input type="date" v-model="desde" @change="cargar" />
        <span>→</span>
        <input type="date" v-model="hasta" @change="cargar" />
      </div>
    </div>

    <p v-if="cargando" class="dim">Cargando análisis…</p>

    <template v-else>
      <!-- RESUMEN -->
      <section class="metricas">
        <div class="card met">
          <span class="m-label">Vendido</span>
          <span class="m-val">{{ fmt(resumen.total_vendido) }}</span>
          <span v-if="resumen.variacion_pct !== null" class="m-delta"
                :class="resumen.variacion_pct >= 0 ? 'up' : 'down'">
            {{ resumen.variacion_pct >= 0 ? '▲' : '▼' }} {{ Math.abs(resumen.variacion_pct) }}%
            <span class="m-delta-sub">vs antes</span>
          </span>
        </div>
        <div class="card met">
          <span class="m-label">Ganancia est.</span>
          <span class="m-val ok">{{ fmt(resumen.ganancia_estimada) }}</span>
          <span class="m-delta-sub">margen {{ resumen.margen_pct }}%</span>
        </div>
        <div class="card met">
          <span class="m-label">Ventas</span>
          <span class="m-val">{{ resumen.numero_ventas }}</span>
          <span class="m-delta-sub">ticket {{ fmt(resumen.ticket_promedio) }}</span>
        </div>
        <div class="card met">
          <span class="m-label">Por cobrar</span>
          <span class="m-val warn">{{ fmt(fiado.total_por_cobrar) }}</span>
          <span class="m-delta-sub">{{ fiado.top_deudores.length }} deudores</span>
        </div>
      </section>

      <!-- TENDENCIA POR DÍA -->
      <section class="card panel">
        <h2>Ventas por día</h2>
        <div v-if="serieDia.length" class="chart-dia">
          <div v-for="d in serieDia" :key="d.dia" class="cd-col">
            <div class="cd-bar" :style="{ height: (Number(d.total) / maxDia * 100) + '%' }"
                 :title="fmtFecha(d.dia) + ': ' + fmt(d.total)"></div>
            <span class="cd-lbl">{{ fmtFecha(d.dia) }}</span>
          </div>
        </div>
        <p v-else class="dim">Sin ventas en el periodo.</p>
      </section>

      <!-- HORAS PICO -->
      <section class="card panel">
        <h2>Horas pico</h2>
        <div v-if="serieHora.length" class="chart-hora">
          <div v-for="h in serieHora" :key="h.hora" class="ch-row">
            <span class="ch-hora">{{ horaTxt(h.hora) }}</span>
            <div class="ch-track">
              <div class="ch-fill" :style="{ width: (Number(h.total) / maxHora * 100) + '%' }"></div>
            </div>
            <span class="ch-val">{{ fmt(h.total) }}</span>
          </div>
        </div>
        <p v-else class="dim">Sin datos.</p>
      </section>

      <!-- PRODUCTOS -->
      <section class="card panel">
        <h2>Productos más vendidos</h2>
        <ol v-if="prod.mas_vendidos.length" class="ranking">
          <li v-for="p in prod.mas_vendidos" :key="p.descripcion" class="rk">
            <span class="rk-desc">{{ p.descripcion }}</span>
            <span class="rk-cant">{{ Number(p.cantidad).toLocaleString('es-CR') }} u.</span>
            <span class="rk-monto">{{ fmt(p.monto) }}</span>
          </li>
        </ol>
        <p v-else class="dim">Sin ventas de productos catalogados.</p>
      </section>

      <!-- STOCK CRÍTICO -->
      <section v-if="prod.stock_critico && prod.stock_critico.length" class="card panel alerta">
        <h2>Stock crítico</h2>
        <ul class="lista-simple">
          <li v-for="p in prod.stock_critico" :key="p.id">
            <span>{{ p.nombre }}</span>
            <span class="stock-num">{{ p.stock_actual }}</span>
          </li>
        </ul>
      </section>

      <!-- NO ROTAN -->
      <section v-if="prod.no_rotan.length" class="card panel">
        <h2>No se vendieron en el periodo</h2>
        <ul class="lista-simple">
          <li v-for="p in prod.no_rotan" :key="p.id">
            <span>{{ p.nombre }}</span>
            <span class="dim">stock: {{ p.stock_actual }}</span>
          </li>
        </ul>
      </section>

      <!-- FIADO -->
      <section class="card panel">
        <h2>Fiado en el periodo</h2>
        <div class="fiado-cifras">
          <div class="fc"><span class="fc-lbl">Otorgado</span><span class="fc-val warn">{{ fmt(fiado.fiado_otorgado) }}</span></div>
          <div class="fc"><span class="fc-lbl">Abonado</span><span class="fc-val ok">{{ fmt(fiado.abonos_recibidos) }}</span></div>
          <div class="fc"><span class="fc-lbl">Balance</span>
            <span class="fc-val" :class="fiado.balance_periodo >= 0 ? 'ok' : 'warn'">{{ fmt(fiado.balance_periodo) }}</span>
          </div>
        </div>
        <h3 class="sub">Deuda más antigua</h3>
        <ul class="lista-simple">
          <li v-for="a in fiado.antiguedad" :key="a.nombre">
            <span>{{ a.nombre }}</span>
            <span class="dim">desde {{ fmtFecha(a.desde) }}</span>
            <span class="warn">{{ fmt(a.saldo) }}</span>
          </li>
        </ul>
      </section>


    </template>
  </div>
</template>

<style scoped>
.wrap { max-width: 760px; margin: 0 auto; padding: 1rem 1.25rem 4rem; }
.top { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
.top h1 { flex: 1; font-size: 1.5rem; }
.mini { min-height: 42px; padding: 0.5rem 0.9rem; }
.dim { color: var(--text-dim); }
.ok { color: var(--ok); }
.warn { color: var(--warn); }

.filtros { padding: 1rem 1.2rem; margin-bottom: 1.25rem; display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items: center; }
.atajos { display: flex; gap: 0.5rem; }
.chip-btn { background: var(--bg-elev); border: 1px solid var(--border); color: var(--text); padding: 0.5rem 0.9rem; border-radius: 999px; cursor: pointer; font-size: 0.85rem; font-family: var(--font-display); }
.chip-btn:hover { border-color: var(--accent); }
.fechas { display: flex; align-items: center; gap: 0.5rem; }
.fechas input { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem; color: var(--text); }

.metricas { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.9rem; margin-bottom: 1.25rem; }
.met { padding: 1.1rem; display: flex; flex-direction: column; gap: 0.25rem; }
.m-label { color: var(--text-dim); font-size: 0.82rem; }
.m-val { font-family: var(--font-display); font-size: 1.5rem; font-weight: 800; }
.m-val.ok { color: var(--ok); } .m-val.warn { color: var(--warn); }
.m-delta { font-size: 0.82rem; font-weight: 600; }
.m-delta.up { color: var(--ok); } .m-delta.down { color: var(--danger); }
.m-delta-sub { color: var(--text-dim); font-size: 0.78rem; font-weight: 400; }

.panel { padding: 1.4rem; margin-bottom: 1.25rem; }
.panel h2 { font-size: 1.1rem; margin-bottom: 1rem; }
.panel.alerta { border-color: var(--warn); }
.sub { font-size: 0.95rem; color: var(--text-dim); margin: 1.2rem 0 0.6rem; }

.chart-dia { display: flex; align-items: flex-end; gap: 0.3rem; height: 140px; }
.cd-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.3rem; height: 100%; justify-content: flex-end; }
.cd-bar { width: 100%; max-width: 28px; background: linear-gradient(to top, var(--accent), var(--accent-press)); border-radius: 4px 4px 0 0; min-height: 3px; }
.cd-lbl { font-size: 0.65rem; color: var(--text-dim); transform: rotate(-45deg); white-space: nowrap; }

.chart-hora { display: flex; flex-direction: column; gap: 0.4rem; }
.ch-row { display: grid; grid-template-columns: 48px 1fr auto; gap: 0.6rem; align-items: center; }
.ch-hora { font-size: 0.8rem; color: var(--text-dim); }
.ch-track { background: var(--bg-elev); border-radius: 999px; height: 18px; overflow: hidden; }
.ch-fill { height: 100%; background: var(--accent-2); border-radius: 999px; }
.ch-val { font-size: 0.8rem; min-width: 70px; text-align: right; }

.ranking { list-style: none; counter-reset: r; }
.rk { display: grid; grid-template-columns: 1fr auto auto; gap: 0.8rem; padding: 0.6rem 0; border-bottom: 1px solid var(--border); align-items: center; }
.rk::before { counter-increment: r; content: counter(r); color: var(--accent); font-family: var(--font-display); font-weight: 700; margin-right: 0.4rem; }
.rk-cant { color: var(--text-dim); font-size: 0.85rem; }
.rk-monto { font-weight: 600; }

.lista-simple { list-style: none; }
.lista-simple li { display: flex; justify-content: space-between; gap: 0.8rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border); }
.stock-num { color: var(--warn); font-weight: 700; }

.fiado-cifras { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.8rem; margin-bottom: 0.5rem; }
.fc { background: var(--bg-elev); border-radius: var(--radius-sm); padding: 0.8rem; display: flex; flex-direction: column; gap: 0.2rem; }
.fc-lbl { color: var(--text-dim); font-size: 0.78rem; }
.fc-val { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; }

.caja-resumen { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.8rem; margin-bottom: 1rem; }
.cr { display: flex; flex-direction: column; gap: 0.2rem; }
.cr .dim { font-size: 0.78rem; }
.cierres { list-style: none; }
.cierre-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.6rem; padding: 0.5rem 0; border-bottom: 1px solid var(--border); font-size: 0.9rem; }
</style>