<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

// Rango de fechas contables (Rango predeterminado: últimos 30 días)
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

// Ajustes rápidos de rango fiscal
function rango(dias: number) {
  desde.value = isoHace(dias)
  hasta.value = new Date().toISOString().slice(0, 10)
  cargar()
}

// Escalamiento matemático de componentes gráficos nativos
const maxDia = computed(() => Math.max(1, ...serieDia.value.map((d) => Number(d.total))))
const maxHora = computed(() => Math.max(1, ...serieHora.value.map((h) => Number(h.total))))

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
        <h1>Auditoría y Reportes</h1>
        <button class="btn-exportar" @click="exportarCsv" title="Exportar CSV">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span class="lbl-btn">Exportar CSV</span>
        </button>
      </div>
    </header>

    <div class="filtros card fade-up" style="animation-delay: 0.05s">
      <div class="atajos">
        <button class="chip-btn" @click="rango(7)">7 Días</button>
        <button class="chip-btn" @click="rango(30)">Mes</button>
        <button class="chip-btn" @click="rango(90)">Trimestre</button>
      </div>
      <div class="fechas">
        <input type="date" v-model="desde" @change="cargar" aria-label="Fecha inicial" />
        <span class="flecha-intermedio">→</span>
        <input type="date" v-model="hasta" @change="cargar" aria-label="Fecha final" />
      </div>
    </div>

    <p v-if="cargando" class="dim loader-text">Procesando datos de auditoría comercial…</p>

    <template v-else>
      <section class="metricas fade-up" style="animation-delay: 0.1s">
        <div class="card met">
          <span class="m-label">Ventas Netas</span>
          <span class="m-val">{{ fmt(resumen.total_vendido) }}</span>
          <span
            v-if="resumen.variacion_pct !== null"
            class="m-delta"
            :class="resumen.variacion_pct >= 0 ? 'up' : 'down'"
          >
            {{ resumen.variacion_pct >= 0 ? '▲' : '▼' }} {{ Math.abs(resumen.variacion_pct) }}%
            <span class="m-delta-sub">vs previo</span>
          </span>
        </div>
        <div class="card met">
          <span class="m-label">Utilidad Est.</span>
          <span class="m-val ok">{{ fmt(resumen.ganancia_estimada) }}</span>
          <span class="m-delta-sub">Margen: {{ resumen.margen_pct }}%</span>
        </div>
        <div class="card met">
          <span class="m-label">Transacciones</span>
          <span class="m-val">{{ resumen.numero_ventas }}</span>
          <span class="m-delta-sub">Ticket: {{ fmt(resumen.ticket_promedio) }}</span>
        </div>
        <div class="card met">
          <span class="m-label">Por Cobrar</span>
          <span class="m-val warn">{{ fmt(fiado.total_por_cobrar) }}</span>
          <span class="m-delta-sub">{{ fiado.top_deudores.length }} activas</span>
        </div>
      </section>

      <section class="card panel fade-up" style="animation-delay: 0.15s">
        <h2>Histórico de Ventas Diarias</h2>
        <div class="chart-container-dia">
          <div v-if="serieDia.length" class="chart-dia">
            <div v-for="d in serieDia" :key="d.dia" class="cd-col">
              <div
                class="cd-bar"
                :style="{ height: (Number(d.total) / maxDia) * 100 + '%' }"
                :title="fmtFecha(d.dia) + ': ' + fmt(d.total)"
              ></div>
              <span class="cd-lbl">{{ fmtFecha(d.dia) }}</span>
            </div>
          </div>
          <p v-else class="dim vacío">No se registran transacciones.</p>
        </div>
      </section>

      <section class="card panel fade-up" style="animation-delay: 0.18s">
        <h2>Curva de Demanda por Hora</h2>
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
        <p v-else class="dim vacío">Datos insuficientes para mapear horas.</p>
      </section>

      <section class="card panel fade-up" style="animation-delay: 0.2s">
        <h2>Productos de Mayor Rotación</h2>
        <ol v-if="prod.mas_vendidos.length" class="ranking">
          <li v-for="p in prod.mas_vendidos" :key="p.descripcion" class="rk">
            <span class="rk-desc">{{ p.descripcion }}</span>
            <div class="rk-meta">
              <span class="rk-cant"
                >{{ Number(p.amount || p.cantidad).toLocaleString('es-CR') }} u.</span
              >
              <span class="rk-monto">{{ fmt(p.monto) }}</span>
            </div>
          </li>
        </ol>
        <p v-else class="dim vacío">Sin ventas en el catálogo.</p>
      </section>

      <section
        v-if="prod.stock_critico && prod.stock_critico.length"
        class="card panel alerta fade-up"
        style="animation-delay: 0.22s"
      >
        <h2>Ruptura de Stock e Inventario Crítico</h2>
        <ul class="lista-simple">
          <li v-for="p in prod.stock_critico" :key="p.id">
            <span>{{ p.nombre }}</span>
            <span class="stock-num">Exist: {{ p.stock_actual }}</span>
          </li>
        </ul>
      </section>

      <section
        v-if="prod.no_rotan.length"
        class="card panel fade-up"
        style="animation-delay: 0.24s"
      >
        <h2>Líneas de Producto con Baja Rotación</h2>
        <ul class="lista-simple">
          <li v-for="p in prod.no_rotan" :key="p.id">
            <span>{{ p.nombre }}</span>
            <span class="dim">Stock: {{ p.stock_actual }}</span>
          </li>
        </ul>
      </section>

      <section class="card panel fade-up" style="animation-delay: 0.26s">
        <h2>Flujo de Crédito Comercial</h2>
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

        <h3 class="sub">Cartera Morosa</h3>
        <ul class="lista-simple">
          <li v-for="a in fiado.antiguedad" :key="a.nombre" class="antiguedad-row">
            <div class="antiguedad-info">
              <span class="nombre-deudor">{{ a.nombre }}</span>
              <span class="dim text-xs">Desde: {{ fmtFecha(a.desde) }}</span>
            </div>
            <span class="warn font-semibold">{{ fmt(a.saldo) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<style scoped>
.wrap {
  max-width: 840px;
  margin: 0 auto;
  padding: 1rem 0.5rem 3rem;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden; /* Evita que el contenedor principal rompa hacia los lados */
}

/* Cabecera Responsiva */
.top {
  margin-bottom: 1.2rem;
  width: 100%;
}
.top-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}
.top h1 {
  flex: 1;
  font-size: clamp(1.1rem, 4.5vw, 1.5rem);
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-regresar {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #cbd5e1;
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-exportar {
  padding: 0 0.6rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  height: 36px;
  flex-shrink: 0;
}
.btn-exportar:hover {
  border-color: var(--accent, #a3e635);
  color: var(--accent, #a3e635);
}

.dim {
  color: var(--text-dim, #64748b);
}
.loader-text {
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem 0;
}
.vacío {
  font-size: 0.85rem;
  padding: 0.5rem 0;
  font-style: italic;
  text-align: center;
}
.text-xs {
  font-size: 0.75rem;
}
.font-semibold {
  font-weight: 600;
}
.ok {
  color: var(--accent, #a3e635) !important;
}
.warn {
  color: #fde047 !important;
}

/* Tarjetas ERP */
.card {
  background: var(--bg-card, #111422);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  border-radius: 8px;
  box-sizing: border-box;
}

/* Panel de Filtros */
.filtros {
  padding: 0.8rem;
  margin-bottom: 1.2rem;
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
  text-align: center;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  color: #cbd5e1;
  padding: 0.45rem 0.2rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
}
.fechas {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
}
.fechas input {
  flex: 1;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  border-radius: 6px;
  padding: 0.45rem 0.3rem;
  color: #ffffff;
  font-size: 0.8rem;
  min-width: 0; /* Clave para evitar desbordes en inputs */
}
.flecha-intermedio {
  color: #64748b;
  font-size: 0.8rem;
}

/* Grid de KPIs */
.metricas {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
  margin-bottom: 1.2rem;
}
.met {
  padding: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.m-label {
  color: #64748b;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
}
.m-val {
  font-size: clamp(1.1rem, 4vw, 1.4rem);
  font-weight: 700;
  color: #ffffff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.m-delta {
  font-size: 0.72rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}
.m-delta-sub {
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.65rem;
}

/* Paneles */
.panel {
  padding: 1rem;
  margin-bottom: 1rem;
  box-sizing: border-box;
}
.panel h2 {
  font-size: 0.85rem;
  margin: 0 0 0.85rem 0;
  font-weight: 600;
  text-transform: uppercase;
  color: #ffffff;
  letter-spacing: 0.02em;
}
.panel.alerta {
  border-color: rgba(239, 68, 68, 0.25);
}
.sub {
  font-size: 0.8rem;
  font-weight: 600;
  color: #cbd5e1;
  margin: 1rem 0 0.5rem 0;
  text-transform: uppercase;
}

/* Contenedor de Scroll para Gráfico Diario (No rompe la vista vertical) */
.chart-container-dia {
  width: 100%;
  overflow-x: auto;
  padding-bottom: 0.25rem;
  -webkit-overflow-scrolling: touch;
}
.chart-dia {
  display: flex;
  align-items: flex-end;
  gap: 0.35rem;
  height: 120px;
  padding-top: 0.5rem;
  min-width: 420px; /* Hace scroll interno seguro en celulares pequeños */
}
.cd-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
}
.cd-bar {
  width: 100%;
  max-width: 18px;
  background: linear-gradient(to top, var(--accent, #a3e635), #bef264);
  border-radius: 3px 3px 0 0;
  min-height: 2px;
}
.cd-lbl {
  font-size: 0.65rem;
  color: #64748b;
  margin-top: 0.25rem;
}

/* Curva por Horas Reajustada */
.chart-hora {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ch-row {
  display: grid;
  grid-template-columns: 40px 1fr 65px;
  gap: 0.4rem;
  align-items: center;
}
.ch-hora {
  font-size: 0.72rem;
  color: #cbd5e1;
}
.ch-track {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 3px;
  height: 10px;
  overflow: hidden;
}
.ch-fill {
  height: 100%;
  background: #60a5fa;
}
.ch-val {
  font-size: 0.72rem;
  text-align: right;
  font-weight: 600;
  color: #ffffff;
}

/* Rankings */
.ranking {
  list-style: none;
  padding: 0;
  margin: 0;
  counter-reset: r;
}
.rk {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}
.rk::before {
  counter-increment: r;
  content: counter(r);
  color: var(--accent, #a3e635);
  font-weight: 700;
  font-size: 0.8rem;
  min-width: 14px;
}
.rk-desc {
  font-size: 0.8rem;
  color: #ffffff;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rk-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.rk-cant {
  color: #64748b;
  font-size: 0.7rem;
}
.rk-monto {
  font-size: 0.8rem;
  font-weight: 600;
  color: #ffffff;
}

.lista-simple {
  list-style: none;
  padding: 0;
  margin: 0;
}
.lista-simple li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 0.8rem;
  color: #cbd5e1;
}
.stock-num {
  color: #f87171;
  font-weight: 600;
}
.nombre-deudor {
  font-weight: 500;
  color: #ffffff;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Sección Flujo de Créditos */
.fiado-cifras {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.4rem;
}
.fc {
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
}
.fc-lbl {
  color: #64748b;
  font-size: 0.68rem;
}
.fc-val {
  font-weight: 700;
  font-size: 0.85rem;
}

.antiguedad-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.4rem;
}
.antiguedad-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
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

/* ====================== CONTROL EXCLUSIVO PARA TELÉFONOS < 480px ====================== */
@media (max-width: 480px) {
  .lbl-btn {
    display: none;
  } /* Remueve el texto "Exportar CSV" dejando solo el ícono seguro */
  .btn-exportar {
    width: 36px;
    padding: 0;
    justify-content: center;
  }

  .fechas {
    position: relative;
  }
  .fechas input {
    font-size: 0.78rem;
    padding: 0.45rem 0.2rem;
    text-align: center;
  }

  .metricas {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.4rem;
  }
  .met {
    padding: 0.6rem;
  }
}

/* ====================== ADAPTACIÓN TABLETS / ESCRITORIO ====================== */
@media (min-width: 600px) {
  .wrap {
    padding: 1.5rem 1rem 4rem;
  }
  .top-row {
    gap: 1rem;
  }
  .filtros {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
  }
  .atajos {
    width: auto;
    flex: 1;
  }
  .chip-btn {
    padding: 0.5rem 0.8rem;
    font-size: 0.82rem;
  }
  .fechas {
    width: auto;
    gap: 0.5rem;
  }
  .fechas input {
    width: 135px;
    font-size: 0.88rem;
  }

  .metricas {
    grid-template-columns: repeat(4, 1fr);
    gap: 0.8rem;
  }
  .fiado-cifras {
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .chart-container-dia {
    overflow: hidden;
  }
  .chart-dia {
    min-width: initial;
    height: 150px;
  }
  .cd-bar {
    max-width: 26px;
  }

  .ch-row {
    grid-template-columns: 50px 1fr 85px;
    gap: 0.6rem;
  }

  .rk {
    grid-template-columns: 1fr auto auto;
    display: grid;
    gap: 1rem;
  }
  .rk-meta {
    display: contents;
  }
  .rk-cant {
    text-align: right;
    font-size: 0.85rem;
  }
  .rk-monto {
    text-align: right;
    min-width: 85px;
    font-size: 0.88rem;
  }
}
</style>
