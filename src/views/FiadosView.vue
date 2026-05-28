<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

interface Cliente { id: number; nombre: string; telefono?: string; saldo: number }
interface Movimiento { id: number; tipo: string; monto: number; fecha: string }

const clientes = ref<Cliente[]>([])
const totalPorCobrar = ref(0)
const cargando = ref(true)
const seleccionado = ref<Cliente | null>(null)
const historial = ref<Movimiento[]>([])
const montoAbono = ref('')
const mostrarNuevo = ref(false)
const nuevoNombre = ref('')
const nuevoTel = ref('')

function fmt(n: number) { return '₡' + Number(n).toLocaleString('es-CR') }

async function cargar() {
  cargando.value = true
  try {
    const { data } = await api.get('/reportes/quien-me-debe')
    clientes.value = data.clientes
    totalPorCobrar.value = data.total_por_cobrar
  } finally { cargando.value = false }
}
onMounted(cargar)

async function abrirCliente(c: Cliente) {
  seleccionado.value = c
  const { data } = await api.get(`/customers/${c.id}`)
  historial.value = data.historial
}
async function abonar() {
  if (!seleccionado.value) return
  const m = parseFloat(montoAbono.value)
  if (!(m > 0)) return
  await api.post(`/customers/${seleccionado.value.id}/abono`, { monto: m })
  montoAbono.value = ''
  await abrirCliente(seleccionado.value)
  await cargar()
}
async function crearCliente() {
  if (!nuevoNombre.value) return
  await api.post('/customers', { nombre: nuevoNombre.value, telefono: nuevoTel.value })
  nuevoNombre.value = ''; nuevoTel.value = ''; mostrarNuevo.value = false
  await cargar()
}
function inicial(nombre: string) { return nombre.charAt(0).toUpperCase() }
</script>

<template>
  <div class="page">
    <header class="page-head">
      <button class="back" @click="router.push('/')">←</button>
      <h1>Fiados</h1>
      <button class="btn btn-primary mini" @click="mostrarNuevo = true">+ Cliente</button>
    </header>

    <div class="resumen">
      <span class="r-label">Total por cobrar</span>
      <span class="r-val">{{ fmt(totalPorCobrar) }}</span>
      <span class="r-sub">{{ clientes.length }} {{ clientes.length === 1 ? 'cliente debe' : 'clientes deben' }}</span>
    </div>

    <p v-if="cargando" class="dim center">Cargando…</p>
    <div v-else-if="!clientes.length" class="vacio card">
      <p class="v-title">Nadie debe nada</p>
      <p class="dim">Todo al día. Cuando vendás a fiado, los clientes aparecen aquí.</p>
    </div>

    <ul v-else class="lista">
      <li v-for="c in clientes" :key="c.id" class="cliente" @click="abrirCliente(c)">
        <div class="avatar">{{ inicial(c.nombre) }}</div>
        <div class="c-info">
          <span class="c-nombre">{{ c.nombre }}</span>
          <span v-if="c.telefono" class="c-tel">{{ c.telefono }}</span>
        </div>
        <span class="c-saldo">{{ fmt(c.saldo) }}</span>
      </li>
    </ul>

    <!-- Detalle -->
    <div v-if="seleccionado" class="modal-bg" @click.self="seleccionado = null">
      <div class="modal">
        <div class="det-head">
          <div class="avatar grande">{{ inicial(seleccionado.nombre) }}</div>
          <div>
            <h3>{{ seleccionado.nombre }}</h3>
            <span class="saldo-grande">{{ fmt(seleccionado.saldo) }}</span>
          </div>
        </div>

        <div class="abono-row">
          <input v-model="montoAbono" type="number" inputmode="decimal" placeholder="Monto del abono" class="inp" />
          <button class="btn btn-primary" @click="abonar">Abonar</button>
        </div>

        <h4 class="hist-title">Movimientos</h4>
        <ul class="hist">
          <li v-for="m in historial" :key="m.id" class="hist-item">
            <span class="h-tipo" :class="m.tipo">{{ m.tipo }}</span>
            <span class="h-monto">{{ fmt(m.monto) }}</span>
            <span class="h-fecha">{{ new Date(m.fecha).toLocaleDateString('es-CR') }}</span>
          </li>
        </ul>
        <button class="btn btn-ghost btn-block" @click="seleccionado = null">Cerrar</button>
      </div>
    </div>

    <!-- Nuevo cliente -->
    <div v-if="mostrarNuevo" class="modal-bg" @click.self="mostrarNuevo = false">
      <div class="modal">
        <h3>Nuevo cliente</h3>
        <div class="field"><label>Nombre</label><input v-model="nuevoNombre" /></div>
        <div class="field"><label>Teléfono (opcional)</label><input v-model="nuevoTel" inputmode="tel" /></div>
        <div class="modal-acciones">
          <button class="btn btn-ghost" @click="mostrarNuevo = false">Cancelar</button>
          <button class="btn btn-primary" @click="crearCliente">Crear</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.resumen { background: linear-gradient(150deg, var(--warn-soft), var(--bg-card) 65%); border: 1px solid rgba(251,191,36,0.25); border-radius: var(--radius); padding: 1.5rem; display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: var(--sp-4); }
.r-label { color: var(--text-dim); font-size: var(--fs-sm); }
.r-val { font-family: var(--font-display); font-size: var(--fs-2xl); font-weight: 800; color: var(--warn); line-height: 1; }
.r-sub { color: var(--text-faint); font-size: var(--fs-xs); }
.center { text-align: center; padding: 2rem 0; }
.vacio { padding: 2.5rem 1.5rem; text-align: center; }
.v-title { font-family: var(--font-display); font-weight: 600; font-size: var(--fs-md); margin-bottom: 0.4rem; }
.lista { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
.cliente { display: flex; align-items: center; gap: 0.9rem; padding: 0.9rem 1.1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: border-color 0.15s, transform 0.08s; }
.cliente:hover { border-color: var(--accent); }
.cliente:active { transform: scale(0.99); }
.avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--accent-2-soft); color: var(--accent-2); display: grid; place-items: center; font-family: var(--font-display); font-weight: 700; font-size: var(--fs-md); flex-shrink: 0; }
.avatar.grande { width: 56px; height: 56px; font-size: var(--fs-lg); }
.c-info { flex: 1; display: flex; flex-direction: column; }
.c-nombre { font-weight: 600; }
.c-tel { color: var(--text-dim); font-size: var(--fs-sm); }
.c-saldo { font-family: var(--font-display); font-weight: 700; color: var(--warn); font-size: var(--fs-md); }
.det-head { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.3rem; }
.saldo-grande { font-family: var(--font-display); font-size: var(--fs-lg); font-weight: 800; color: var(--warn); }
.abono-row { display: flex; gap: 0.6rem; margin-bottom: 1.5rem; }
.abono-row .inp { flex: 1; }
.hist-title { font-size: var(--fs-sm); color: var(--text-dim); margin-bottom: 0.7rem; }
.hist { list-style: none; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.2rem; }
.hist-item { display: grid; grid-template-columns: auto 1fr auto; gap: 0.8rem; padding: 0.6rem 0; border-bottom: 1px solid var(--border-soft); align-items: center; }
.h-tipo { font-size: var(--fs-xs); font-weight: 600; text-transform: capitalize; padding: 0.25rem 0.7rem; border-radius: var(--radius-pill); }
.h-tipo.consumo { background: var(--danger-soft); color: var(--danger); }
.h-tipo.abono { background: var(--ok-soft); color: var(--ok); }
.h-monto { font-weight: 600; }
.h-fecha { color: var(--text-dim); font-size: var(--fs-xs); }
</style>