<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

interface Sesion {
  id: number
  monto_inicial: number
  efectivo_esperado?: number
  efectivo_contado?: number
  diferencia?: number
  apertura: string
  cierre?: string
}

const sesion = ref<Sesion | null>(null)
const cargando = ref(true)
const montoInicial = ref('')
const efectivoContado = ref('')
const resumenCierre = ref<any>(null)

function fmt(n: number) { return '₡' + Number(n).toLocaleString('es-CR') }

async function cargar() {
  cargando.value = true
  try {
    const { data } = await api.get('/caja/actual')
    sesion.value = data
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

async function abrir() {
  const m = parseFloat(montoInicial.value) || 0
  const { data } = await api.post('/caja/abrir', { monto_inicial: m })
  sesion.value = data
  montoInicial.value = ''
}

async function cerrar() {
  if (!sesion.value) return
  const c = parseFloat(efectivoContado.value)
  if (!(c >= 0)) return
  const { data } = await api.post(`/caja/${sesion.value.id}/cerrar`, {
    efectivo_contado: c,
  })
  resumenCierre.value = { sesion: data.session, resumen: data.resumen }
  sesion.value = null
  efectivoContado.value = ''
}
</script>

<template>
  <div class="wrap">
    <header class="top">
      <button class="btn btn-ghost mini" @click="router.push('/')">←</button>
      <h1>Caja</h1>
    </header>

    <p v-if="cargando" class="dim">Cargando…</p>

    <!-- Sin caja abierta -->
    <div v-else-if="!sesion" class="card panel">
      <h2>Abrir caja</h2>
      <p class="dim">Empezá el día registrando el efectivo con el que abrís.</p>
      <div class="field">
        <label>Monto inicial (opcional)</label>
        <input v-model="montoInicial" type="number" placeholder="₡ 0" />
      </div>
      <button class="btn btn-primary btn-block" @click="abrir">Abrir caja</button>
    </div>

    <!-- Caja abierta -->
    <div v-else class="card panel">
      <span class="chip on">Caja abierta</span>
      <div class="dato">
        <span class="d-label">Monto inicial</span>
        <span class="d-val">{{ fmt(sesion.monto_inicial) }}</span>
      </div>
      <div class="dato">
        <span class="d-label">Abierta desde</span>
        <span class="d-val">{{ new Date(sesion.apertura).toLocaleString('es-CR') }}</span>
      </div>

      <h2 style="margin-top:1.5rem">Cerrar y arquear</h2>
      <p class="dim">Contá el efectivo en la caja y escribí el total.</p>
      <div class="field">
        <label>Efectivo contado</label>
        <input v-model="efectivoContado" type="number" placeholder="₡ 0" />
      </div>
      <button class="btn btn-primary btn-block" @click="cerrar">Cerrar caja</button>
    </div>

    <!-- Resumen del cierre -->
    <div v-if="resumenCierre" class="modal-bg" @click.self="resumenCierre = null">
      <div class="modal card">
        <h3>Cierre de caja</h3>
        <div class="cierre-grid">
          <div class="cg-item">
            <span>Efectivo esperado</span>
            <strong>{{ fmt(resumenCierre.sesion.efectivo_esperado) }}</strong>
          </div>
          <div class="cg-item">
            <span>Efectivo contado</span>
            <strong>{{ fmt(resumenCierre.sesion.efectivo_contado) }}</strong>
          </div>
          <div class="cg-item destacado" :class="resumenCierre.sesion.diferencia < 0 ? 'falta' : 'sobra'">
            <span>Diferencia</span>
            <strong>{{ fmt(resumenCierre.sesion.diferencia) }}</strong>
          </div>
        </div>

        <h4>Resumen del periodo</h4>
        <div class="dato"><span class="d-label">Total vendido</span><span class="d-val">{{ fmt(resumenCierre.resumen.total_vendido) }}</span></div>
        <div class="dato"><span class="d-label">N° de ventas</span><span class="d-val">{{ resumenCierre.resumen.numero_ventas }}</span></div>
        <div class="dato"><span class="d-label">Efectivo</span><span class="d-val">{{ fmt(resumenCierre.resumen.desglose_pago.efectivo) }}</span></div>
        <div class="dato"><span class="d-label">SINPE/Tarjeta</span><span class="d-val">{{ fmt(resumenCierre.resumen.desglose_pago.manual) }}</span></div>
        <div class="dato"><span class="d-label">Fiado otorgado</span><span class="d-val">{{ fmt(resumenCierre.resumen.fiado_otorgado) }}</span></div>

        <button class="btn btn-primary btn-block" style="margin-top:1.2rem" @click="resumenCierre = null">Listo</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { max-width: 560px; margin: 0 auto; padding: 1rem 1.25rem 4rem; }
.top { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.top h1 { font-size: 1.5rem; }
.mini { min-height: 42px; padding: 0.5rem 1rem; }
.dim { color: var(--text-dim); }
.panel { padding: 1.8rem; }
.panel h2 { font-size: 1.2rem; margin-bottom: 0.4rem; }
.panel .dim { margin-bottom: 1.2rem; font-size: 0.9rem; }
.chip { display: inline-block; font-size: 0.78rem; font-weight: 600; padding: 0.35rem 0.8rem; border-radius: 999px; margin-bottom: 1.2rem; }
.chip.on { background: rgba(52,211,153,0.15); color: var(--ok); }
.dato { display: flex; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid var(--border); }
.d-label { color: var(--text-dim); }
.d-val { font-weight: 600; }
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; padding: 1rem; z-index: 50; backdrop-filter: blur(4px); }
.modal { padding: 1.8rem; width: 100%; max-width: 420px; max-height: 85vh; overflow-y: auto; }
.modal h3 { font-size: 1.3rem; margin-bottom: 1.2rem; }
.modal h4 { font-size: 1rem; margin: 1.5rem 0 0.5rem; color: var(--text-dim); }
.cierre-grid { display: flex; flex-direction: column; gap: 0.6rem; }
.cg-item { display: flex; justify-content: space-between; padding: 0.8rem 1rem; background: var(--bg-elev); border-radius: var(--radius-sm); }
.cg-item.destacado { font-size: 1.1rem; }
.cg-item.destacado.falta { background: rgba(248,113,113,0.12); color: var(--danger); }
.cg-item.destacado.sobra { background: rgba(52,211,153,0.12); color: var(--ok); }
</style>
