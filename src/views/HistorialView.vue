<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

interface Pago { tipo: string; monto: number }
interface Item { descripcion: string; cantidad: number; precio_unitario: number; descuento: number }
interface Venta {
  id: number
  total: number
  estado: string
  fecha: string
  motivo_anulacion?: string
  items: Item[]
  payments: Pago[]
}

const ventas = ref<Venta[]>([])
const cargando = ref(true)
const seleccionada = ref<Venta | null>(null)
const motivoAnular = ref('')
const anulando = ref(false)

function fmt(n: number) { return '₡' + Number(n).toLocaleString('es-CR') }
function fmtFecha(f: string) {
  return new Date(f).toLocaleString('es-CR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function cargar() {
  cargando.value = true
  try {
    const { data } = await api.get('/sales')
    ventas.value = data.data || data // soporta paginado o array
  } finally {
    cargando.value = false
  }
}
onMounted(cargar)

function abrir(v: Venta) {
  seleccionada.value = v
  motivoAnular.value = ''
}

async function anular() {
  if (!seleccionada.value || !motivoAnular.value.trim()) return
  anulando.value = true
  try {
    await api.post(`/sales/${seleccionada.value.id}/anular`, { motivo: motivoAnular.value })
    seleccionada.value = null
    await cargar()
  } catch (e: any) {
    alert(e.response?.data?.message || 'No se pudo anular.')
  } finally {
    anulando.value = false
  }
}

function pagosTxt(v: Venta) {
  const map: Record<string, string> = { efectivo: 'Efectivo', fiado: 'Fiado', manual: 'SINPE/Tarjeta' }
  return v.payments.map((p) => map[p.tipo] || p.tipo).join(', ')
}
</script>

<template>
  <div class="wrap">
    <header class="top">
      <button class="btn btn-ghost mini" @click="router.push('/')">←</button>
      <h1>Historial de ventas</h1>
    </header>

    <p v-if="cargando" class="dim">Cargando…</p>
    <p v-else-if="!ventas.length" class="dim">Todavía no hay ventas.</p>

    <ul v-else class="lista">
      <li v-for="v in ventas" :key="v.id" class="venta" :class="{ anulada: v.estado === 'anulada' }" @click="abrir(v)">
        <div class="v-info">
          <span class="v-fecha">{{ fmtFecha(v.fecha) }}</span>
          <span class="v-pago">{{ pagosTxt(v) }}</span>
        </div>
        <div class="v-derecha">
          <span class="v-total">{{ fmt(v.total) }}</span>
          <span v-if="v.estado === 'anulada'" class="badge-anulada">Anulada</span>
        </div>
      </li>
    </ul>

    <!-- Detalle / anular -->
    <div v-if="seleccionada" class="modal-bg" @click.self="seleccionada = null">
      <div class="modal card">
        <h3>Venta #{{ seleccionada.id }}</h3>
        <p class="dim">{{ fmtFecha(seleccionada.fecha) }}</p>

        <ul class="det-items">
          <li v-for="(it, i) in seleccionada.items" :key="i">
            <span>{{ it.cantidad }}× {{ it.descripcion }}</span>
            <span>{{ fmt(it.cantidad * it.precio_unitario - it.descuento) }}</span>
          </li>
        </ul>
        <div class="det-total"><span>Total</span><span>{{ fmt(seleccionada.total) }}</span></div>

        <template v-if="seleccionada.estado === 'anulada'">
          <p class="anulada-msg">Anulada: {{ seleccionada.motivo_anulacion }}</p>
        </template>
        <template v-else>
          <div class="anular-box">
            <label>Motivo de anulación</label>
            <input v-model="motivoAnular" placeholder="Ej: cliente se arrepintió" />
            <button class="btn anular-btn" :disabled="anulando || !motivoAnular.trim()" @click="anular">
              Anular venta
            </button>
          </div>
        </template>

        <button class="btn btn-ghost btn-block" @click="seleccionada = null">Cerrar</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { max-width: 700px; margin: 0 auto; padding: 1rem 1.25rem 4rem; }
.top { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.top h1 { font-size: 1.5rem; }
.mini { min-height: 42px; padding: 0.5rem 0.9rem; }
.dim { color: var(--text-dim); text-align: center; padding: 2rem 0; }
.lista { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
.venta { display: flex; justify-content: space-between; align-items: center; padding: 0.9rem 1.2rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: border-color 0.15s; }
.venta:hover { border-color: var(--accent); }
.venta.anulada { opacity: 0.55; }
.v-info { display: flex; flex-direction: column; gap: 0.2rem; }
.v-fecha { font-weight: 600; }
.v-pago { color: var(--text-dim); font-size: 0.82rem; }
.v-derecha { display: flex; align-items: center; gap: 0.7rem; }
.v-total { font-family: var(--font-display); font-weight: 700; }
.badge-anulada { font-size: 0.72rem; background: rgba(248,113,113,0.15); color: var(--danger); padding: 0.2rem 0.6rem; border-radius: 999px; }
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; padding: 1rem; z-index: 50; backdrop-filter: blur(4px); }
.modal { padding: 1.8rem; width: 100%; max-width: 420px; max-height: 88vh; overflow-y: auto; }
.modal h3 { font-size: 1.3rem; }
.det-items { list-style: none; margin: 1rem 0; }
.det-items li { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid var(--border); font-size: 0.92rem; }
.det-total { display: flex; justify-content: space-between; font-family: var(--font-display); font-weight: 800; font-size: 1.1rem; padding: 0.6rem 0; }
.anulada-msg { color: var(--danger); background: rgba(248,113,113,0.1); padding: 0.8rem; border-radius: var(--radius-sm); margin: 1rem 0; font-size: 0.9rem; }
.anular-box { margin: 1.2rem 0; padding-top: 1rem; border-top: 1px solid var(--border); }
.anular-box label { color: var(--text-dim); font-size: 0.85rem; display: block; margin-bottom: 0.5rem; }
.anular-box input { width: 100%; background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.8rem; color: var(--text); min-height: 48px; margin-bottom: 0.8rem; }
.anular-box input:focus { outline: none; border-color: var(--danger); }
.anular-btn { width: 100%; background: var(--danger); color: #fff; }
.anular-btn:disabled { opacity: 0.5; }
</style>