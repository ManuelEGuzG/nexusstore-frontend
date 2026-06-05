<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'

const router = useRouter()

interface Pago { 
  tipo: 'efectivo' | 'fiado' | 'manual' | string
  monto: number 
}

interface Item { 
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number 
}

interface Venta {
  id: number
  total: number
  estado: 'completada' | 'anulada' | string
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

function fmt(n: number) { 
  return '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) 
}

function fmtFecha(f: string) {
  return new Date(f).toLocaleString('es-CR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

async function cargar() {
  cargando.value = true
  try {
    const { data } = await api.get('/sales')
    ventas.value = data.data || data
  } catch {
    /* Mitigación silente de excepciones de pasarela de red */
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
    await api.post(`/sales/${seleccionada.value.id}/anular`, { motivo: motivoAnular.value.trim() })
    seleccionada.value = null
    await cargar()
  } catch (e: any) {
    alert(e.response?.data?.message || 'Error operativo: No fue posible reversar la transacción.')
  } finally {
    anulando.value = false
  }
}

function pagosTxt(v: Venta) {
  const glosarioMedios: Record<string, string> = { 
    efectivo: 'Efectivo', 
    fiado: 'Crédito Comercial', 
    manual: 'Transacción Electrónica (SINPE/Tarjeta)' 
  }
  return v.payments.map((p) => glosarioMedios[p.tipo] || p.tipo).join(', ')
}
</script>

<template>
  <div class="wrap fade-up">
    <header class="top">
      <button class="back" @click="router.push('/')" aria-label="Retornar al panel central">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      </button>
      <h1>Auditoría y Registro de Ventas</h1>
    </header>

    <p v-if="cargando" class="dim state-msg">Sincronizando bitácora de transacciones fiscales…</p>
    <p v-else-if="!ventas.length" class="dim state-msg">No se registran transacciones devengadas en el periodo contable.</p>

    <ul v-else class="lista">
      <li 
        v-for="v in ventas" 
        :key="v.id" 
        class="venta card" 
        :class="{ anulada: v.estado === 'anulada' }" 
        @click="abrir(v)"
      >
        <div class="v-info">
          <span class="v-fecha">{{ fmtFecha(v.fecha) }}</span>
          <span class="v-pago">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:4px; vertical-align:middle;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
            {{ pagosTxt(v) }}
          </span>
        </div>
        <div class="v-derecha">
          <span class="v-total">{{ fmt(v.total) }}</span>
          <span v-if="v.estado === 'anulada'" class="badge-anulada">Reversada</span>
        </div>
      </li>
    </ul>

    <Teleport to="body">
      <div v-if="seleccionada" class="modal-bg" @click.self="seleccionada = null">
        <div class="modal card">
          <div class="det-head">
            <h3>Comprobante Fiscal #{{ seleccionada.id }}</h3>
            <p class="dim font-mono">{{ fmtFecha(seleccionada.fecha) }}</p>
          </div>

          <ul class="det-items">
            <li v-for="(it, i) in seleccionada.items" :key="i">
              <span class="item-desc">{{ it.cantidad }} u. × {{ it.descripcion }}</span>
              <span class="item-monto">{{ fmt(it.cantidad * it.precio_unitario - it.descuento) }}</span>
            </li>
          </ul>
          
          <div class="det-total">
            <span>Monto Consolidado</span>
            <span class="total-destacado">{{ fmt(seleccionada.total) }}</span>
          </div>

          <template v-if="seleccionada.estado === 'anulada'">
            <div class="anulada-msg" role="alert">
              <strong>Transacción Invalidada:</strong> {{ seleccionada.motivo_anulacion }}
            </div>
          </template>
          
          <template v-else>
            <div class="anular-box">
              <label for="f-motivo">Justificación de Reversión Fiscal</label>
              <input 
                id="f-motivo" 
                v-model="motivoAnular" 
                placeholder="Ej. Error en pasarela de pago o devolución" 
              />
              <button 
                class="btn anular-btn" 
                :disabled="anulando || !motivoAnular.trim()" 
                @click="anular"
              >
                {{ anulando ? 'Procesando Reversión…' : 'Anular Transacción' }}
              </button>
            </div>
          </template>

          <button class="btn btn-ghost btn-block" @click="seleccionada = null">Cerrar Registro</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.wrap {
  padding: clamp(1rem, 3vw, 2rem);
  max-width: 750px;
  margin: 0 auto;
}

.top {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.top h1 {
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

.state-msg { text-align: center; padding: 3rem 0; color: #64748b; font-size: 0.9rem; }

/* Lista de Ventas Estilo Ledger */
.lista { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.card { background: var(--bg-card, #111422); border: 1px solid var(--border, rgba(255,255,255,0.06)); border-radius: var(--radius-sm, 12px); }

.venta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.venta:hover {
  border-color: rgba(163, 230, 53, 0.2);
  background: linear-gradient(to right, #111422, var(--bg-hover, #15192b));
}
.venta.anulada { opacity: 0.45; }

.v-info { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.v-fecha { font-weight: 600; color: #f1f5f9; font-size: 0.95rem; }
.v-pago { color: #64748b; font-size: 0.8rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }

.v-derecha { display: flex; align-items: center; gap: 0.8rem; flex-shrink: 0; }
.v-total { font-weight: 700; color: #ffffff; font-size: 1.05rem; }

.badge-anulada {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  border: 1px solid rgba(239, 68, 68, 0.15);
}

/* Modal Detalle de Factura */
.det-head { margin-bottom: 1.2rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.8rem; }
.det-head h3 { margin: 0 0 0.2rem 0; font-size: 1.15rem; color: #ffffff; font-weight: 700; }
.font-mono { font-family: monospace; font-size: 0.8rem; margin: 0; color: #64748b; }

.det-items { list-style: none; padding: 0; margin: 1rem 0; max-height: 200px; overflow-y: auto; }
.det-items li { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.9rem; align-items: center; }
.item-desc { color: #e2e8f0; max-width: 70%; text-overflow: ellipsis; overflow: hidden; }
.item-monto { color: #ffffff; font-weight: 500; }

.det-total { display: flex; justify-content: space-between; font-weight: 700; font-size: 1rem; padding: 0.8rem 0; color: #cbd5e1; border-top: 1px solid rgba(255,255,255,0.08); }
.total-destacado { color: var(--accent, #a3e635); font-size: 1.2rem; font-weight: 800; letter-spacing: -0.01em; }

/* Controladores de Anulación Contable */
.anulada-msg {
  color: #f87171;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.15);
  padding: 0.8rem;
  border-radius: 6px;
  margin: 1.2rem 0;
  font-size: 0.88rem;
  line-height: 1.4;
}

.anular-box { margin: 1.2rem 0; padding-top: 1.2rem; border-top: 1px solid rgba(255,255,255,0.08); }
.anular-box label { color: #cbd5e1; font-size: 0.8rem; font-weight: 600; display: block; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.04em; }
.anular-box input {
  width: 100%;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  padding: 0.75rem 0.9rem;
  color: #ffffff;
  font-size: 0.92rem;
  margin-bottom: 0.8rem;
}
.anular-box input:focus { outline: none; border-color: #ef4444; }

/* Botones Base */
.btn {
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.anular-btn { width: 100%; background: #ef4444; color: #ffffff; font-weight: 600; height: 42px; }
.anular-btn:hover:not(:disabled) { background: #dc2626; }
.anular-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-ghost {
  background: transparent;
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

.btn-block { 
  width: 100%; 
  height: 40px; 
  font-weight: 600; 
  margin-top: 0.5rem; 
}

/* Capa de Fondo del Modal (Viewport Completo) */
.modal-bg { 
  position: fixed; 
  inset: 0; 
  background: rgba(6, 8, 13, 0.85); 
  display: grid; 
  place-items: center; 
  padding: 1rem; 
  z-index: 9999; /* Asegura superposición absoluta en la app */
  backdrop-filter: blur(4px); 
}

.modal { 
  padding: 1.6rem; 
  width: 100%; 
  max-width: 430px; 
  max-height: 88vh; 
  overflow-y: auto; 
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.4); 
}

/* Animación de entrada */
.fade-up {
  opacity: 0;
  transform: translateY(6px);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slideUp { to { opacity: 1; transform: translateY(0); } }

@media (max-width: 500px) {
  .venta { flex-wrap: wrap; gap: 0.4rem; }
  .v-info { width: 100%; }
  .v-derecha { width: 100%; justify-content: space-between; }

  .det-items li { flex-direction: column; align-items: flex-start; gap: 0.2rem; }
  .item-desc { max-width: 100%; }

  .btn-ghost.btn-block { margin-top: 0.75rem; }
}

/* Gestión de scroll interno del modal */
.det-items::-webkit-scrollbar { width: 4px; }
.det-items::-webkit-scrollbar-track { background: transparent; }
.det-items::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
</style>