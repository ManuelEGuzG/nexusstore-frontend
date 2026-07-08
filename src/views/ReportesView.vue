<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

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

function rango(dias: number) {
  desde.value = isoHace(dias)
  hasta.value = new Date().toISOString().slice(0, 10)
  cargar()
}

const maxDia = computed(() => Math.max(1, ...serieDia.value.map((d) => Number(d.total))))
const maxHora = computed(() => Math.max(1, ...serieHora.value.map((h) => Number(h.total))))

const strokeDashoffset = computed(() => {
  const margen = resumen.value?.margen_pct || 0
  const porcentaje = Math.min(100, Math.max(0, margen))
  const circunf = Math.PI * 50
  return circunf - (porcentaje / 100) * circunf
})

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
        <button
          class="btn-regresar"
          @click="router.push('/')"
          aria-label="Volver al panel principal"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
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
          <h1>Resumen Operativo</h1>
          <p class="subtitle">Auditoría analítica de rendimiento comercial</p>
        </div>
        <button class="btn-exportar" @click="exportarCsv" title="Exportar CSV">
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span class="lbl-btn">Exportar</span>
        </button>
      </div>
    </header>

    <div class="filtros card fade-up" style="animation-delay: 0.05s">
      <div class="atajos">
        <button class="chip-btn" @click="rango(7)">7 Días</button>
        <button class="chip-btn" @click="rango(30)">Este Mes</button>
        <button class="chip-btn" @click="rango(90)">Trimestre</button>
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
        <div class="card met">
          <div class="met-header">
            <span class="m-label">Ventas Netas</span>
            <div class="met-icon-box ic-green">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
          <span class="m-val">{{ fmt(resumen.total_vendido) }}</span>
          <div
            v-if="resumen.variacion_pct !== null"
            class="m-delta"
            :class="resumen.variacion_pct >= 0 ? 'up' : 'down'"
          >
            <span class="delta-chip"
              >{{ resumen.variacion_pct >= 0 ? '+' : '' }}{{ resumen.variacion_pct }}%</span
            >
            <span class="m-delta-sub">vs mes anterior</span>
          </div>
        </div>

        <div class="card met">
          <div class="met-header">
            <span class="m-label">Transacciones</span>
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
          <span class="m-val">{{ resumen.numero_ventas }}</span>
          <div class="m-delta">
            <span class="m-delta-sub"
              >Ticket Promedio:
              <strong class="txt-bright">{{ fmt(resumen.ticket_promedio) }}</strong></span
            >
          </div>
        </div>

        <div class="card met">
          <div class="met-header">
            <span class="m-label">Por Cobrar</span>
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
          <span class="m-val warn">{{ fmt(fiado.total_por_cobrar) }}</span>
          <div class="m-delta">
            <span class="m-delta-sub"
              ><strong class="txt-bright">{{ fiado.top_deudores.length }}</strong> créditos
              vigentes</span
            >
          </div>
        </div>
      </section>

      <div class="dashboard-grid">
        <section class="card panel main-chart fade-up" style="animation-delay: 0.15s">
          <div class="panel-header">
            <h2>Evolución Diaria</h2>
            <span class="panel-tag">Ventas totales</span>
          </div>
          <div class="chart-container-dia">
            <div v-if="serieDia.length" class="chart-dia">
              <div v-for="d in serieDia" :key="d.dia" class="cd-col">
                <div class="cd-bar-wrapper">
                  <div
                    class="cd-bar"
                    :style="{ height: (Number(d.total) / maxDia) * 100 + '%' }"
                    :title="fmtFecha(d.dia) + ': ' + fmt(d.total)"
                  >
                    <div class="bar-glow"></div>
                  </div>
                </div>
                <span class="cd-lbl">{{ fmtFecha(d.dia) }}</span>
              </div>
            </div>
            <p v-else class="dim vacío">Sin transacciones registradas.</p>
          </div>
        </section>

        <section class="card panel gauge-panel fade-up" style="animation-delay: 0.18s">
          <div class="panel-header">
            <h2>Margen de Utilidad</h2>
          </div>
          <div class="gauge-box">
            <div class="gauge-svg-wrap">
              <svg viewBox="0 0 120 70" class="gauge-element">
                <path
                  d="M 10 60 A 50 50 0 0 1 110 60"
                  fill="none"
                  stroke="#121622"
                  stroke-width="10"
                  stroke-linecap="round"
                />
                <path
                  d="M 10 60 A 50 50 0 0 1 110 60"
                  fill="none"
                  stroke="var(--accent, #a3e635)"
                  stroke-width="10"
                  stroke-linecap="round"
                  stroke-dasharray="157.08"
                  :stroke-dashoffset="strokeDashoffset"
                  class="gauge-progress"
                />
              </svg>
              <div class="gauge-center-text">
                <span class="gauge-big-val">{{ fmt(resumen.ganancia_estimada) }}</span>
                <span class="gauge-sub">Ganancia Estimada</span>
              </div>
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
          <h2>Productos Más Vendidos</h2>
          <ol v-if="prod.mas_vendidos.length" class="ranking">
            <li v-for="p in prod.mas_vendidos" :key="p.descripcion" class="rk">
              <span class="rk-desc" :title="p.descripcion">{{ p.descripcion }}</span>
              <div class="rk-stats-box">
                <span class="rk-cant"
                  >{{ Number(p.amount || p.cantidad).toLocaleString('es-CR') }} u.</span
                >
                <span class="rk-monto">{{ fmt(p.monto) }}</span>
              </div>
            </li>
          </ol>
          <p v-else class="dim vacío">Sin ventas en catálogo.</p>
        </section>

        <section class="card panel fade-up" style="animation-delay: 0.22s">
          <h2>Frecuencia Horaria</h2>
          <div v-if="serieHora.length" class="chart-hora">
            <div v-for="h in serieHora" :key="h.hora" class="ch-row">
              <span class="ch-hora">{{ horaTxt(h.hora) }}</span>
              <div class="ch-track">
                <div
                  class="ch-fill"
                  :style="{ width: (Number(h.total) / maxHora) * 100 + '%' }"
                ></div>
              </div>
              <span class="ch-val">{{ fmt(h.total) }}</span>
            </div>
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
                <span class="prod-nombre">{{ p.nombre }}</span>
                <span class="stock-num">Quedan {{ p.stock_actual }}</span>
              </li>
            </ul>
          </section>

          <section class="card panel fade-up" style="animation-delay: 0.26s">
            <h2>Flujo de Crédito</h2>
            <div class="fiado-cifras">
              <div class="fc">
                <span class="fc-lbl">Otorgado</span>
                <span class="fc-val warn">{{ fmt(fiado.fiado_otorgado) }}</span>
              </div>
              <div class="fc">
                <span class="fc-lbl">Abonos</span>
                <span class="fc-val ok">{{ fmt(fiado.abonos_recibidos) }}</span>
              </div>
              <div class="fc">
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
.wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding: clamp(0.75rem, 3vw, 2rem) 0.75rem 4rem;
  box-sizing: border-box;
  width: 100%;
}

.top {
  margin-bottom: 1.5rem;
  width: 100%;
}
.top-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.title-area {
  flex: 1;
  min-width: 0;
}
.top h1 {
  font-size: clamp(1.15rem, 3.5vw, 1.6rem);
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;
}
.subtitle {
  margin-top: 0.2rem;
  font-size: 0.8rem;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-regresar,
.btn-exportar {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #cbd5e1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 38px;
}
.btn-regresar {
  width: 38px;
  flex-shrink: 0;
}
.btn-exportar {
  padding: 0 0.85rem;
  font-size: 0.8rem;
  font-weight: 600;
  gap: 0.4rem;
}
.btn-regresar:hover,
.btn-exportar:hover {
  border-color: var(--accent, #a3e635);
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.card {
  background: var(--bg-card, #111422);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-sm, 12px);
}

.filtros {
  padding: 0.85rem;
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.atajos {
  display: flex;
  gap: 0.35rem;
  width: 100%;
}
.chip-btn {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
  padding: 0.6rem 0.25rem;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.chip-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--accent, #a3e635);
  border-color: var(--accent, #a3e635);
}
.fechas {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
.fechas input {
  flex: 1;
  min-width: 0;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 0.55rem;
  color: #ffffff;
  font-size: 0.85rem;
  text-align: center;
}
.fechas input:focus {
  outline: none;
  border-color: var(--accent, #a3e635);
}
.flecha-intermedio {
  color: #64748b;
}

.metricas {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}
.met {
  padding: 1.1rem;
}
.met-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.35rem;
}
.m-label {
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.met-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ic-green {
  background: rgba(163, 230, 53, 0.08);
  color: var(--accent, #a3e635);
}
.ic-blue {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}
.ic-warn {
  background: rgba(245, 158, 11, 0.08);
  color: #f59e0b;
}

.m-val {
  font-size: 1.4rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.02em;
}
.m-delta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.4rem;
}
.delta-chip {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}
.up .delta-chip {
  background: rgba(163, 230, 53, 0.12);
  color: var(--accent, #a3e635);
}
.down .delta-chip {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
}
.m-delta-sub {
  color: #64748b;
  font-size: 0.75rem;
}
.txt-bright {
  color: #e2e8f0;
}

.dashboard-grid,
.details-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.panel {
  padding: 1.1rem;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}
.panel h2 {
  font-size: 0.85rem;
  margin: 0;
  font-weight: 700;
  text-transform: uppercase;
  color: #ffffff;
  letter-spacing: 0.04em;
}
.panel-tag {
  font-size: 0.68rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  color: #64748b;
}

.chart-container-dia {
  width: 100%;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}
.chart-container-dia::-webkit-scrollbar {
  height: 4px;
}
.chart-container-dia::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
}

.chart-dia {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  height: 140px;
  min-width: 520px;
}
.cd-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.cd-bar-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.cd-bar {
  width: 100%;
  max-width: 20px;
  background: linear-gradient(to top, #3b82f6, var(--accent, #a3e635));
  border-radius: 4px 4px 0 0;
  position: relative;
  min-height: 4px;
}
.bar-glow {
  position: absolute;
  top: 0;
  inset: 0;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1), transparent);
  border-radius: 4px 4px 0 0;
}
.cd-lbl {
  font-size: 0.68rem;
  color: #64748b;
  margin-top: 0.4rem;
  font-weight: 500;
}

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
  max-width: 180px;
}
.gauge-element {
  width: 100%;
  height: auto;
}
.gauge-center-text {
  position: absolute;
  bottom: 6px;
  left: 0;
  right: 0;
  text-align: center;
}
.gauge-big-val {
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
  display: block;
}
.gauge-sub {
  font-size: 0.68rem;
  color: #64748b;
}
.gauge-footer-metric {
  margin-top: 0.75rem;
  display: flex;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.45rem 1rem;
  border-radius: 6px;
  font-size: 0.78rem;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.ranking {
  list-style: none;
  padding: 0;
  margin: 0;
}
.rk {
  display: flex;
  flex-direction: column;
  padding: 0.65rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.rk:last-child {
  border-bottom: none;
}
.rk-desc {
  font-size: 0.85rem;
  color: #cbd5e1;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
.rk-stats-box {
  display: flex;
  justify-content: space-between;
  margin-top: 0.15rem;
}
.rk-cant {
  color: #64748b;
  font-size: 0.78rem;
}
.rk-monto {
  font-size: 0.85rem;
  font-weight: 700;
  color: #ffffff;
}

.chart-hora {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.ch-row {
  display: grid;
  grid-template-columns: 42px 1fr 65px;
  gap: 0.5rem;
  align-items: center;
}
.ch-hora {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
}
.ch-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 100px;
  height: 6px;
  overflow: hidden;
}
.ch-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 100px;
}
.ch-val {
  font-size: 0.75rem;
  text-align: right;
  font-weight: 700;
  color: #ffffff;
}

.badge-critico {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}
.lista-simple {
  list-style: none;
  padding: 0;
  margin: 0;
}
.lista-simple li {
  display: flex;
  justify-content: space-between;
  padding: 0.65rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 0.85rem;
}
.lista-simple li:last-child {
  border-bottom: none;
}
.prod-nombre {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 70%;
  color: #e2e8f0;
}
.stock-num {
  color: #f87171;
  font-weight: 600;
}

.fiado-cifras {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.fc {
  background: rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 0.65rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.fc-lbl {
  color: #64748b;
  font-size: 0.75rem;
}
.fc-val {
  font-weight: 700;
  font-size: 0.85rem;
}

.vertical-subgrid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ok {
  color: var(--accent, #a3e635);
}
.warn {
  color: #f59e0b;
}
.dim {
  color: #64748b;
}
.vacío {
  text-align: center;
  padding: 1.5rem 0;
  font-size: 0.8rem;
  color: #64748b;
}

.loader-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
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

@media (min-width: 480px) {
  .filtros {
    flex-direction: row;
    align-items: center;
  }
  .atajos,
  .fechas {
    width: auto;
  }
  .atajos {
    flex: 1;
  }
  .fechas input {
    width: 135px;
  }
  .rk {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
  .rk-stats-box {
    gap: 1.5rem;
    margin-top: 0;
  }
}

@media (min-width: 768px) {
  .metricas {
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  .dashboard-grid {
    grid-template-columns: 2fr 1fr;
    gap: 1.25rem;
  }
}

@media (min-width: 1024px) {
  .details-grid {
    grid-template-columns: 1.2fr 1fr 1fr;
    gap: 1.25rem;
  }
}
</style>
