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

const rangoActivo = ref(30)
function rango(dias: number) {
  rangoActivo.value = dias
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
                  stroke="#161b2c"
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
          <div class="panel-header">
            <h2>Productos Más Vendidos</h2>
          </div>
          <ol v-if="prod.mas_vendidos.length" class="ranking">
            <li v-for="(p, i) in prod.mas_vendidos" :key="p.descripcion" class="rk">
              <span class="rk-pos" :class="{ 'rk-pos-top': i === 0 }">{{ i + 1 }}</span>
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
          <div class="panel-header">
            <h2>Frecuencia Horaria</h2>
          </div>
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
.chart-dia {
  display: flex;
  align-items: flex-end;
  gap: 0.4rem;
  height: 130px;
  min-width: max-content;
}
.cd-col {
  width: 30px;
  flex-shrink: 0;
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
  max-width: 18px;
  background: linear-gradient(180deg, var(--accent, #a3e635), #3b82f6);
  border-radius: 5px 5px 2px 2px;
  position: relative;
  min-height: 4px;
}
.bar-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.15), transparent 60%);
  border-radius: 5px 5px 2px 2px;
}
.cd-lbl {
  font-size: 0.62rem;
  color: #7c8aa5;
  margin-top: 0.5rem;
  font-weight: 500;
  white-space: nowrap;
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
.gauge-element {
  width: 100%;
  height: auto;
}
.gauge-progress {
  filter: drop-shadow(0 0 6px rgba(163, 230, 53, 0.45));
}
.gauge-center-text {
  position: absolute;
  bottom: 6px;
  left: 0;
  right: 0;
  text-align: center;
  padding: 0 0.5rem;
}
.gauge-big-val {
  font-size: clamp(0.95rem, 4.5vw, 1.15rem);
  font-weight: 700;
  color: #ffffff;
  display: block;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gauge-sub {
  font-size: 0.65rem;
  color: #7c8aa5;
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
  align-items: center;
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
}
.rk-pos-top {
  background: rgba(163, 230, 53, 0.15);
  color: var(--accent, #a3e635);
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

/* ---------- Frecuencia horaria ---------- */
.chart-hora {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.ch-row {
  display: grid;
  grid-template-columns: 38px 1fr auto;
  gap: 0.5rem;
  align-items: center;
}
.ch-hora {
  font-size: 0.72rem;
  color: #7c8aa5;
  font-weight: 500;
}
.ch-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 100px;
  height: 7px;
  overflow: hidden;
  min-width: 0;
}
.ch-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, var(--accent, #a3e635));
  border-radius: 100px;
}
.ch-val {
  font-size: 0.72rem;
  text-align: right;
  font-weight: 700;
  color: #e2e8f0;
  white-space: nowrap;
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
  .cd-col {
    width: auto;
    flex: 1;
  }
  .chart-dia {
    min-width: 520px;
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
