<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

interface Cliente {
  id: number
  nombre: string
  telefono?: string
  saldo: number
}

interface Movimiento {
  id: number
  tipo: 'consumo' | 'abono' | string
  monto: number
  fecha: string
}

const clientes = ref<Cliente[]>([])
const totalPorCobrar = ref(0)
const cargando = ref(true)
const seleccionado = ref<Cliente | null>(null)
const historial = ref<Movimiento[]>([])
const montoAbono = ref('')
const mostrarNuevo = ref(false)
const nuevoNombre = ref('')
const nuevoTel = ref('')

function fmt(n: number) {
  return (
    '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  )
}

async function cargar() {
  cargando.value = true
  try {
    const { data } = await api.get('/reportes/quien-me-debe')
    clientes.value = data.clientes || []
    totalPorCobrar.value = data.total_por_cobrar || 0
  } catch {
    /* Gestión preventiva de excepciones de conectividad */
  } finally {
    cargando.value = false
  }
}

onMounted(cargar)

async function abrirCliente(c: Cliente) {
  seleccionado.value = c
  try {
    const { data } = await api.get(`/customers/${c.id}`)
    historial.value = data.historial || []
  } catch {
    alert('No se pudo recuperar el histórico contable del cliente.')
  }
}

async function abonar() {
  if (!seleccionado.value) return
  const m = parseFloat(montoAbono.value)
  if (!(m > 0)) return

  try {
    await api.post(`/customers/${seleccionado.value.id}/abono`, { monto: m })
    montoAbono.value = ''
    await abrirCliente(seleccionado.value)
    await cargar()
  } catch {
    alert('Error al registrar la transacción de pago.')
  }
}

async function crearCliente() {
  if (!nuevoNombre.value.trim()) return
  try {
    await api.post('/customers', { nombre: nuevoNombre.value, telefono: nuevoTel.value })
    nuevoNombre.value = ''
    nuevoTel.value = ''
    mostrarNuevo.value = false
    await cargar()
  } catch {
    alert('No fue posible dar de alta la cuenta de cliente.')
  }
}

function inicial(nombre: string) {
  return nombre ? nombre.charAt(0).toUpperCase() : '?'
}
</script>

<template>
  <div class="page fade-up">
    <header class="page-head">
      <button class="back" @click="router.push('/')" aria-label="Regresar al menú principal">
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
      <h1>Cuentas por Cobrar</h1>
      <button class="btn btn-primary mini-btn" @click="mostrarNuevo = true">
        + Registrar Cliente
      </button>
    </header>

    <div class="resumen card">
      <div class="resumen-contenido">
        <span class="r-label">Cartera Pendiente de Cobro</span>
        <span class="r-val">{{ fmt(totalPorCobrar) }}</span>
        <span class="r-sub">
          {{ clientes.length }}
          {{
            clientes.length === 1
              ? 'cuenta activa con balance en mora'
              : 'cuentas activas con balance en mora'
          }}
        </span>
      </div>
    </div>

    <p v-if="cargando" class="dim state-msg">Consultando estados de cuenta vigentes…</p>

    <div v-else-if="!clientes.length" class="vacio card">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="vacio-icon"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <p class="v-title">Cartera de Crédito al Día</p>
      <p class="dim">Todos los balances de clientes se encuentran liquidados de forma integral.</p>
    </div>

    <ul v-else class="lista">
      <li v-for="c in clientes" :key="c.id" class="cliente card" @click="abrirCliente(c)">
        <div class="avatar">{{ inicial(c.nombre) }}</div>
        <div class="c-info">
          <span class="c-nombre">{{ c.nombre }}</span>
          <span v-if="c.telefono" class="c-tel">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              style="display: inline; margin-right: 3px; vertical-align: middle"
            >
              <path
                d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
              ></path>
            </svg>
            {{ c.telefono }}
          </span>
        </div>
        <div class="c-monto-wrapper">
          <span class="c-saldo">{{ fmt(c.saldo) }}</span>
        </div>
      </li>
    </ul>

    <div v-if="seleccionado" class="modal-bg" @click.self="seleccionado = null">
      <div class="modal card">
        <div class="det-head">
          <div class="avatar grande">{{ inicial(seleccionado.nombre) }}</div>
          <div>
            <h3>{{ seleccionado.nombre }}</h3>
            <span class="saldo-grande">{{ fmt(seleccionado.saldo) }}</span>
          </div>
        </div>

        <div class="abono-container">
          <label for="f-abono" class="field-label">Registrar Recibo de Dinero (Amortización)</label>
          <div class="abono-row">
            <input
              id="f-abono"
              v-model="montoAbono"
              type="number"
              inputmode="decimal"
              placeholder="Monto liquidado (₡)"
              class="inp"
            />
            <button class="btn btn-primary" @click="abonar">Procesar Pago</button>
          </div>
        </div>

        <h4 class="hist-title">Historial de Transacciones</h4>

        <div class="hist-wrapper">
          <ul v-if="historial.length" class="hist">
            <li v-for="m in historial" :key="m.id" class="hist-item">
              <span class="h-tipo" :class="m.tipo">
                {{ m.tipo === 'consumo' ? 'Crédito' : 'Abono' }}
              </span>
              <span class="h-monto" :class="m.tipo"
                >{{ m.tipo === 'abono' ? '-' : '+' }}{{ fmt(m.monto) }}</span
              >
              <span class="h-fecha">{{ new Date(m.fecha).toLocaleDateString('es-CR') }}</span>
            </li>
          </ul>
          <p v-else class="dim center fs-xs">
            Sin registros de transacciones previas en este ciclo.
          </p>
        </div>

        <button class="btn btn-ghost btn-block" @click="seleccionado = null">
          Cerrar Expediente
        </button>
      </div>
    </div>

    <div v-if="mostrarNuevo" class="modal-bg" @click.self="mostrarNuevo = false">
      <div class="modal card">
        <h3>Alta de Cuenta Comercial</h3>

        <div class="field">
          <label for="f-nuevo-nombre">Nombre Completo del Titular</label>
          <input
            id="f-nuevo-nombre"
            v-model="nuevoNombre"
            placeholder="Ej. Juan Carlos Alvarado"
            required
          />
        </div>

        <div class="field">
          <label for="f-nuevo-tel">Teléfono de Contacto</label>
          <input id="f-nuevo-tel" v-model="nuevoTel" inputmode="tel" placeholder="Ej. 8888 8888" />
        </div>

        <div class="modal-acciones">
          <button class="btn btn-ghost" @click="mostrarNuevo = false">Cancelar</button>
          <button class="btn btn-primary" @click="crearCliente">Aperturar Cuenta</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: clamp(1rem, 3vw, 2rem);
  max-width: 750px;
  margin: 0 auto;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
}
.page-head h1 {
  flex: 1;
  font-size: clamp(1.2rem, 3vw, 1.6rem);
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;
}

.back {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #cbd5e1;
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.back:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.mini-btn {
  padding: 0.5rem 0.9rem;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 6px;
  height: 38px;
}

/* Tablero de Métricas Consolidadas */
.resumen {
  background: #080a10;
  border: 1px solid rgba(245, 158, 11, 0.15); /* Alerta suave de cuentas pendientes */
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border-radius: var(--radius-sm, 12px);
}
.resumen-contenido {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.r-label {
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.r-val {
  font-size: clamp(1.8rem, 4vw, 2.3rem);
  font-weight: 800;
  color: #f59e0b;
  line-height: 1.1;
  letter-spacing: -0.03em;
}
.r-sub {
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.8rem;
}

.state-msg {
  text-align: center;
  padding: 2.5rem 0;
  color: #64748b;
  font-size: 0.9rem;
}

/* Estado Vacío */
.vacio {
  padding: 3rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}
.vacio-icon {
  color: #b4fe2f;
  opacity: 0.9;
}
.v-title {
  font-weight: 700;
  font-size: 1.1rem;
  color: #ffffff;
  margin: 0;
}

/* Listado Operativo de Clientes */
.lista {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.card {
  background: #090b11;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-sm, 12px);
}

.cliente {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.2rem;
  cursor: pointer;
  transition: all 0.2s ease;
}
.cliente:hover {
  border-color: rgba(245, 158, 11, 0.25);
  background: #0d101a;
  transform: translateY(-1px);
}
.cliente:active {
  transform: translateY(0);
}

.avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(180, 254, 47, 0.05);
  color: #b4fe2f;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 1.1rem;
  flex-shrink: 0;
  border: 1px solid rgba(180, 254, 47, 0.12);
}
.avatar.grande {
  width: 56px;
  height: 56px;
  font-size: 1.4rem;
}

.c-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.c-nombre {
  font-weight: 600;
  color: #ffffff;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
.c-tel {
  color: #64748b;
  font-size: 0.8rem;
}
.c-saldo {
  font-weight: 700;
  color: #f59e0b;
  font-size: 1.05rem;
  letter-spacing: -0.01em;
}

/* Control de Amortización Integrada */
.det-head {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  padding-bottom: 1.2rem;
}
.det-head h3 {
  margin: 0 0 0.2rem 0;
  font-size: 1.2rem;
  color: #ffffff;
  font-weight: 700;
}
.saldo-grande {
  font-size: 1.6rem;
  font-weight: 800;
  color: #f59e0b;
  letter-spacing: -0.02em;
}

.abono-container {
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.field-label {
  color: #cbd5e1;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.abono-row {
  display: flex;
  gap: 0.5rem;
}
.abono-row .inp {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 0.65rem 0.9rem;
  color: #ffffff;
  font-size: 0.92rem;
  transition: border-color 0.2s;
}
.abono-row .inp:focus {
  outline: none;
  border-color: #f59e0b;
}

/* Histórico de Movimientos ERP */
.hist-title {
  font-size: 0.8rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.6rem;
  font-weight: 600;
}
.hist-wrapper {
  max-height: 180px;
  overflow-y: auto;
  margin-bottom: 1.5rem;
  padding-right: 0.25rem;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.02);
}
.hist {
  list-style: none;
  padding: 0 0.6rem;
  margin: 0;
  display: flex;
  flex-direction: column;
}
.hist-item {
  display: grid;
  grid-template-columns: 80px 1fr auto;
  gap: 0.8rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  align-items: center;
}
.hist-item:last-child {
  border-bottom: none;
}

.h-tipo {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  text-align: center;
  width: fit-content;
}
.h-tipo.consumo {
  background: rgba(239, 68, 68, 0.08);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.12);
}
.h-tipo.abono {
  background: rgba(74, 222, 128, 0.08);
  color: #4ade80;
  border: 1px solid rgba(74, 222, 128, 0.12);
}

.h-monto {
  font-weight: 600;
  font-size: 0.9rem;
  text-align: right;
}
.h-monto.consumo {
  color: #f1f5f9;
}
.h-monto.abono {
  color: #4ade80;
}
.h-fecha {
  color: #64748b;
  font-size: 0.78rem;
  justify-self: end;
}

.btn-block {
  width: 100%;
  height: 40px;
  justify-content: center;
  font-weight: 600;
}

/* Botones de Acción Globales */
.btn-primary {
  background: #b4fe2f;
  color: #000000;
  border: none;
  transition: background 0.2s;
}
.btn-primary:hover {
  background: #c2ff55;
}
.btn-ghost {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #cbd5e1;
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

/* Formularios Modales Auxiliares */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.1rem;
}
.field label {
  color: #cbd5e1;
  font-size: 0.82rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.field input {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 0.7rem 0.9rem;
  color: #ffffff;
  font-size: 0.92rem;
  transition: border-color 0.2s;
}
.field input:focus {
  outline: none;
  border-color: #b4fe2f;
}

/* Arquitectura del Fondo Modal */
.modal-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(5, 6, 10, 0.85);
  display: grid;
  place-items: center;
  padding: 1rem;
  z-index: 100;
  backdrop-filter: blur(4px);
}
.modal {
  width: 100%;
  max-width: 440px;
  padding: 1.6rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6);
  background: #080a10;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.modal h3 {
  margin: 0 0 1.2rem 0;
  font-size: 1.2rem;
  color: #ffffff;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.modal-acciones {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

/* Animaciones de Entrada */
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

@media (max-width: 500px) {
  .page-head {
    flex-wrap: wrap;
  }
  .page-head h1 {
    order: -1;
    width: 100%;
  }

  .det-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .saldo-grande {
    font-size: 1.3rem;
  }

  .abono-row {
    flex-direction: column;
  }
  .abono-row .btn {
    width: 100%;
    min-height: 44px;
  }

  .hist-item {
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
    gap: 0.35rem 0.6rem;
  }
  .h-fecha {
    grid-column: 1 / -1;
    padding-top: 0.1rem;
  }

  .modal {
    padding: 1.25rem 1rem 2rem;
    border-radius: 8px;
  }
  .card,
  .resumen {
    border-radius: 8px;
  }
}

/* Scrollbar Customization for Historial */
.hist-wrapper::-webkit-scrollbar {
  width: 4px;
}
.hist-wrapper::-webkit-scrollbar-track {
  background: transparent;
}
.hist-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}
</style>
