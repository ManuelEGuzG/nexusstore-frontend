<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { usePosStore } from '@/stores/pos'
import ComprobanteTiquete from '@/components/ComprobanteTiquete.vue'
import EscanerContinuo from '@/components/EscanerContinuo.vue'

const router = useRouter()
const pos = usePosStore()

interface Producto {
  id: number
  nombre: string
  precio: number
}

interface Cliente {
  id: number
  nombre: string
  saldo: number
}

// Estados reactivos
const productos = ref<Producto[]>([])
const busqueda = ref('')
const enLinea = ref(navigator.onLine)

const mostrarMontoLibre = ref(false)
const mostrarPago = ref(false)
const mostrarTiquete = ref(false)
const montoLibre = ref('')
const carritoAbierto = ref(false)

const mostrarEscaner = ref(false)
const escanerRef = ref<any>(null)

const clientes = ref<Cliente[]>([])
const clienteSeleccionado = ref<number | null>(null)
const procesando = ref(false)

const inputMontoRef = ref<HTMLInputElement | null>(null)

// Computed para filtrar catálogo localmente
const productosFiltrados = computed(() => {
  if (!busqueda.value) return productos.value
  const q = busqueda.value.toLowerCase()
  return productos.value.filter((p) => p.nombre.toLowerCase().includes(q))
})

// Cuenta total de unidades en el carrito
const totalItems = computed(() => pos.items.reduce((s, it) => s + it.cantidad, 0))

// Manejadores de red para actualizar el estado del chip
const actualizarEstadoRed = async (estado: boolean) => {
  enLinea.value = estado
  if (estado) {
    await pos.refrescarPendientes()
  }
}

const handleOnline = () => actualizarEstadoRed(true)
const handleOffline = () => actualizarEstadoRed(false)

onMounted(async () => {
  // Cargar cola local inicial si existiera
  await pos.refrescarPendientes()

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  try {
    const { data } = await api.get('/products')
    productos.value = data
  } catch (error) {
    console.warn('Catálogo local no disponible. Venta por monto libre activa.')
  }
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})

// Formateador de moneda (Colones costarricenses)
function fmt(n: number) {
  return (
    '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  )
}

function abrirMontoLibre() {
  mostrarMontoLibre.value = true
  nextTick(() => {
    inputMontoRef.value?.focus()
  })
}

function confirmarMontoLibre() {
  const m = parseFloat(montoLibre.value)
  if (m > 0) {
    pos.agregarMontoLibre(m)
    montoLibre.value = ''
    mostrarMontoLibre.value = false
  }
}

async function onCodigoLeido(codigo: string) {
  try {
    const { data } = await api.get(`/products/buscar/${codigo}`)
    if (data.encontrado) {
      pos.agregarProducto({
        id: data.producto.id,
        nombre: data.producto.nombre,
        precio: Number(data.producto.precio),
      })
      escanerRef.value?.avisar(`+ ${data.producto.nombre}`, true)
    } else {
      escanerRef.value?.avisar('Producto no registrado', false)
    }
  } catch (e: any) {
    if (e.response?.status === 404) {
      escanerRef.value?.avisar('Producto no registrado', false)
    } else {
      escanerRef.value?.avisar('Sin conexión', false)
    }
  }
}

function ajustarCantidadEscaner(productId: number, delta: number) {
  const idx = pos.items.findIndex((it) => it.product_id === productId)
  if (idx !== -1) {
    pos.cambiarCantidad(idx, pos.items[idx].cantidad + delta)
  }
}

async function abrirPago() {
  if (pos.vacio) return
  try {
    const { data } = await api.get('/customers')
    clientes.value = data
  } catch {
    clientes.value = []
  }
  mostrarPago.value = true
}

async function cobrar(tipo: 'efectivo' | 'fiado' | 'manual') {
  if (tipo === 'fiado' && !clienteSeleccionado.value) return
  procesando.value = true
  try {
    await pos.finalizar({
      tipoPago: tipo,
      customerId: tipo === 'fiado' ? clienteSeleccionado.value : null,
    })
    mostrarPago.value = false
    clienteSeleccionado.value = null
    carritoAbierto.value = false
    mostrarTiquete.value = true
  } catch (error) {
    console.error('Error al procesar el cobro:', error)
  } finally {
    procesando.value = false
  }
}
</script>

<template>
  <div class="pos">
    <!-- Header de Control y Estado de Red -->
    <header class="pos-top">
      <button class="back" @click="router.push('/')" aria-label="Volver">
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
      <h1 class="pos-title">Punto de Venta</h1>
      <div class="estado">
        <span class="chip" :class="enLinea ? 'on' : 'off'">
          <span class="indicator"></span>
          {{ enLinea ? 'En línea' : 'Sin conexión' }}
        </span>
        <Transition name="scale">
          <span v-if="pos.pendientes > 0" class="chip pend">{{ pos.pendientes }} pendientes</span>
        </Transition>
      </div>
    </header>

    <!-- Cuerpo del Módulo -->
    <div class="pos-body">
      <!-- Sección Izquierda: Catálogo y Filtros -->
      <section class="panel-prod">
        <div class="acciones">
          <div class="buscar-contenedor">
            <svg
              class="buscar-icono"
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              v-model="busqueda"
              class="buscar"
              type="search"
              placeholder="Buscar producto por nombre..."
            />
          </div>
          <button class="btn btn-ghost accion-btn" @click="mostrarEscaner = true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
            </svg>
            Escanear
          </button>
          <button class="btn btn-primary accion-btn" @click="abrirMontoLibre">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Monto libre
          </button>
        </div>

        <!-- Grid de Catálogo -->
        <div v-if="productosFiltrados.length" class="grid-prod">
          <button
            v-for="p in productosFiltrados"
            :key="p.id"
            class="prod-btn"
            @click="pos.agregarProducto(p)"
          >
            <span class="prod-nombre">{{ p.nombre }}</span>
            <span class="prod-precio">{{ fmt(p.precio) }}</span>
          </button>
        </div>

        <!-- Estado Vacío -->
        <div v-else class="vacio-prod card animate-fade-in">
          <svg
            class="vacio-icono"
            xmlns="http://www.w3.org/2000/svg"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
            <polygon points="12 22.08 12 12 3 6.92 3 17.08 12 22.08"></polygon>
            <polygon points="12 12 21 6.92 21 17.08 12 22.08 12 12"></polygon>
            <polygon points="12 12 3 6.92 12 1.84 21 6.92 12 12"></polygon>
          </svg>
          <p class="vp-title">No hay productos cargados</p>
          <p class="dim">
            Podés vender por monto libre, escanear códigos de barras o sincronizar el catálogo.
          </p>
        </div>
      </section>

      <!-- Sección Derecha: Carrito Lateral (Desktop) / Panel Desplegable (Mobile) -->
      <section class="panel-cart card" :class="{ abierto: carritoAbierto }">
        <div class="cart-head">
          <h2>Venta Actual</h2>
          <button class="cerrar-cart" @click="carritoAbierto = false" aria-label="Cerrar carrito">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Carrito Vacío -->
        <div v-if="pos.vacio" class="cart-vacio">
          <svg
            class="vacio-cart-icono"
            xmlns="http://www.w3.org/2000/svg"
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <p class="vc-title">El carrito está vacío</p>
          <p class="dim">Seleccioná ítems del catálogo o utilizá el escáner de códigos.</p>
        </div>

        <!-- Lista del Carrito -->
        <div v-else class="cart-contenido">
          <ul class="cart-items">
            <li v-for="(it, i) in pos.items" :key="i" class="cart-item">
              <div class="ci-top">
                <span class="ci-desc">{{ it.descripcion }}</span>
                <button class="qx" @click="pos.quitar(i)" aria-label="Eliminar ítem">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div class="ci-bottom">
                <div class="ci-ctrl">
                  <button
                    class="qbtn"
                    :disabled="it.cantidad <= 1"
                    @click="pos.cambiarCantidad(i, it.cantidad - 1)"
                  >
                    −
                  </button>
                  <span class="qcant">{{ it.cantidad }}</span>
                  <button class="qbtn" @click="pos.cambiarCantidad(i, it.cantidad + 1)">+</button>
                </div>
                <span class="ci-sub">
                  {{ fmt(it.cantidad * it.precio_unitario - it.descuento) }}
                </span>
              </div>
            </li>
          </ul>

          <div class="cart-footer">
            <div class="total-row">
              <span>Total a cobrar</span>
              <span class="total-num">{{ fmt(pos.total) }}</span>
            </div>
            <button
              class="btn btn-primary btn-block cobrar"
              :disabled="pos.vacio"
              @click="abrirPago"
            >
              Proceder al Pago
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Barra de Estado Inferior Flotante (Solo Mobile) -->
    <div
      v-if="!pos.vacio"
      class="cart-bar"
      :class="{ 'cart-bar-oculto': carritoAbierto }"
      @click="carritoAbierto = true"
    >
      <div class="cb-info">
        <span class="cb-count">
          {{ totalItems }} {{ totalItems === 1 ? 'ítem' : 'ítems' }} en cuenta
        </span>
        <span class="cb-total">{{ fmt(pos.total) }}</span>
      </div>
      <span class="cb-ver">Ver detalle ›</span>
    </div>

    <!-- Cortina oscura de Carrito en Mobile -->
    <Transition name="fade">
      <div v-if="carritoAbierto" class="cart-overlay" @click="carritoAbierto = false"></div>
    </Transition>

    <!-- Modal: Agregar Monto Libre -->
    <Transition name="modal-pop">
      <div v-if="mostrarMontoLibre" class="modal-bg" @click.self="mostrarMontoLibre = false">
        <div class="modal">
          <div class="modal-header">
            <h3>Monto libre</h3>
            <p class="dim">Ingresá un valor directo para añadirlo a la cuenta actual.</p>
          </div>
          <input
            ref="inputMontoRef"
            v-model="montoLibre"
            type="number"
            inputmode="decimal"
            placeholder="₡ 0"
            class="monto-input"
            @keyup.enter="confirmarMontoLibre"
          />
          <div class="modal-acciones">
            <button class="btn btn-ghost" @click="mostrarMontoLibre = false">Cancelar</button>
            <button
              class="btn btn-primary"
              :disabled="!montoLibre || parseFloat(montoLibre) <= 0"
              @click="confirmarMontoLibre"
            >
              Agregar al Carrito
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Modal: Pasarela Interna de Cobro -->
    <Transition name="modal-pop">
      <div v-if="mostrarPago" class="modal-bg" @click.self="mostrarPago = false">
        <div class="modal">
          <div class="modal-header">
            <h3>Cobrar {{ fmt(pos.total) }}</h3>
            <p class="dim">Seleccioná el método de liquidación para finalizar.</p>
          </div>
          <div class="pago-opciones">
            <button
              class="btn btn-secondary pago-op"
              :disabled="procesando"
              @click="cobrar('efectivo')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <circle cx="12" cy="12" r="2"></circle>
                <path d="M6 12h.01M18 12h.01"></path>
              </svg>
              Efectivo
            </button>
            <button
              class="btn btn-secondary pago-op"
              :disabled="procesando"
              @click="cobrar('manual')"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
              SINPE Móvil / Tarjeta
            </button>
          </div>

          <!-- Liquidación a Cuenta Corriente (Fiado) -->
          <div class="fiado-bloque">
            <p class="dim pago-sub">Cargar Cuenta Corriente (Crédito):</p>
            <select v-model="clienteSeleccionado" class="select-cliente">
              <option :value="null">Elegí un cliente de la lista…</option>
              <option v-for="c in clientes" :key="c.id" :value="c.id">
                {{ c.nombre }} (Saldo: {{ fmt(c.saldo) }})
              </option>
            </select>
            <button
              class="btn btn-warn btn-block fiar"
              :disabled="procesando || !clienteSeleccionado"
              @click="cobrar('fiado')"
            >
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
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              Confirmar Cuenta Corriente
            </button>
          </div>
          <button class="btn btn-ghost btn-block cerrar-modal" @click="mostrarPago = false">
            Cancelar
          </button>
        </div>
      </div>
    </Transition>

    <!-- Componentes Adicionales Incrustados -->
    <ComprobanteTiquete
      v-if="mostrarTiquete && pos.ultimaVenta"
      :uuid="pos.ultimaVenta.uuid"
      :items="pos.ultimaVenta.items"
      :total="pos.ultimaVenta.total"
      :forma-pago="pos.ultimaVenta.formaPago"
      :fecha="pos.ultimaVenta.fecha"
      @cerrar="mostrarTiquete = false"
    />

    <EscanerContinuo
      v-if="mostrarEscaner"
      ref="escanerRef"
      :items="pos.items"
      @leido="onCodigoLeido"
      @cambiar-cantidad="ajustarCantidadEscaner"
      @cerrar="mostrarEscaner = false"
    />
  </div>
</template>

<style scoped>
/* ==========================================================================
   SISTEMA DE DISEÑO / NEXUSSTORE CORPORATE ULTRADARK COLOR PALETTE
   ========================================================================== */
.pos {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #05060b; /* Fondo negro puro de NexusStore */
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

/* Header de Control y Estado de Red */
.pos-top {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem clamp(1rem, 3vw, 1.5rem);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  background: #080a10; /* Superficie oscura sutil */
  flex-shrink: 0;
}

.back {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.02);
  color: #cbd5e1;
  cursor: pointer;
  display: inline-grid;
  place-items: center;
  transition: all 0.2s ease;
}
.back:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #b4fe2f; /* Verde Lima */
  color: #b4fe2f;
}

.pos-title {
  font-size: clamp(1.1rem, 2vw, 1.25rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #ffffff;
  flex: 1;
  margin: 0;
}

/* Estado de Red e Indicadores */
.estado {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid transparent;
}
.chip.on {
  background: rgba(180, 254, 47, 0.05);
  color: #b4fe2f;
  border-color: rgba(180, 254, 47, 0.1);
}
.chip.on .indicator {
  width: 6px;
  height: 6px;
  background: #b4fe2f;
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(180, 254, 47, 0.6);
}
.chip.off {
  background: rgba(239, 68, 68, 0.08);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.15);
}
.chip.off .indicator {
  width: 6px;
  height: 6px;
  background: #f87171;
  border-radius: 50%;
}
.chip.pend {
  background: rgba(234, 179, 8, 0.1);
  color: #fde047;
  border-color: rgba(234, 179, 8, 0.2);
}

/* Layout del cuerpo */
.pos-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: clamp(0.75rem, 2vw, 1.25rem);
  overflow: hidden;
  min-height: 0;
}

.panel-prod {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* Filtros y Acciones superiores */
.acciones {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 1rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.buscar-contenedor {
  position: relative;
  flex: 1;
  min-width: 200px;
  display: flex;
  align-items: center;
}
.buscar-icono {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.2);
  pointer-events: none;
  display: block;
  z-index: 2;
}
.buscar {
  width: 100%;
  display: block;
  background: #0b0d16;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 0.65rem 0.9rem 0.65rem 2.4rem;
  color: #ffffff;
  font-size: 0.9rem;
  line-height: 1.25rem;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.buscar::-webkit-search-decoration,
.buscar::-webkit-search-cancel-button,
.buscar::-webkit-search-results-button,
.buscar::-webkit-search-results-decoration {
  -webkit-appearance: none;
  appearance: none;
}

.buscar:focus {
  outline: none;
  border-color: #b4fe2f;
}
.buscar-contenedor:focus-within .buscar-icono {
  color: #b4fe2f;
}

/* Botones Base */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1.1rem;
  font-weight: 600;
  font-size: 0.88rem;
  line-height: 1.25rem;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.15s ease;
}
.btn-primary {
  background: #b4fe2f;
  color: #000000;
}
.btn-primary:hover:not(:disabled) {
  background: #c2ff55;
  box-shadow: 0 0 20px rgba(180, 254, 47, 0.25);
}
.btn-secondary {
  background: rgba(255, 255, 255, 0.02);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.05);
}
.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
}

.btn-ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.05);
}
.btn-ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}
.btn-warn {
  background: rgba(239, 68, 68, 0.05);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.1);
}
.btn-warn:hover:not(:disabled) {
  background: #ef4444;
  color: #ffffff;
}
.btn-block {
  width: 100%;
}
.btn:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.accion-btn {
  flex: 1;
  min-width: 110px;
  white-space: nowrap;
}

/* Catálogo Grid */
.grid-prod {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
  gap: 0.6rem;
  overflow-y: auto;
  align-content: start;
  padding-right: 0.25rem;
  min-height: 0;
  flex: 1;
}

/* Tarjeta de Producto */
.prod-btn {
  background: #090b11;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 0.9rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: left;
  min-height: 100px;
  justify-content: space-between;
  position: relative;
  transition: all 0.15s ease;
}
.prod-btn:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: #0e111a;
}
.prod-btn:active {
  transform: scale(0.98);
}

.prod-nombre {
  font-weight: 500;
  font-size: 0.85rem;
  line-height: 1.3;
  color: #cbd5e1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.prod-precio {
  color: #ffffff;
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: -0.01em;
}

/* Estados vacíos corporativos */
.vacio-prod,
.cart-vacio {
  padding: 3rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.005);
  border: 1px dashed rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}
.vacio-icono,
.vacio-cart-icono {
  color: rgba(255, 255, 255, 0.1);
  margin-bottom: 1rem;
}
.vp-title,
.vc-title {
  font-weight: 600;
  font-size: 0.95rem;
  margin-bottom: 0.35rem;
  color: #ffffff;
}
.dim {
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.82rem;
  line-height: 1.4;
  margin: 0;
  max-width: 280px;
}

/* Panel Carrito */
.panel-cart {
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 55;
  max-height: 85vh;
  border-radius: 12px 12px 0 0;
  transform: translateY(110%);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 -12px 32px rgba(0, 0, 0, 0.6);
  background: #080a10;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 1.25rem;
}
.panel-cart.abierto {
  transform: translateY(0);
}
.cart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-shrink: 0;
}
.cart-head h2 {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.cerrar-cart {
  background: rgba(255, 255, 255, 0.03);
  border: none;
  color: #ffffff;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: background 0.2s;
}
.cerrar-cart:hover {
  background: rgba(255, 255, 255, 0.06);
}

.cart-contenido {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.cart-items {
  list-style: none;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  min-height: 0;
  padding: 0 0.2rem 0 0;
  margin: 0;
}
.cart-item {
  background: #0c0e16;
  border-radius: 6px;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.02);
}

.ci-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.ci-desc {
  font-weight: 500;
  font-size: 0.85rem;
  line-height: 1.35;
  color: #e2e8f0;
}
.qx {
  background: rgba(255, 255, 255, 0.02);
  border: none;
  color: rgba(255, 255, 255, 0.3);
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.15s;
  flex-shrink: 0;
}
.qx:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.ci-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ci-ctrl {
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.03);
}
.qbtn {
  width: 30px;
  height: 30px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: #ffffff;
  font-size: 1.1rem;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.qbtn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.03);
  color: #b4fe2f;
}
.qbtn:disabled {
  opacity: 0.15;
  cursor: not-allowed;
}
.qcant {
  min-width: 28px;
  text-align: center;
  font-weight: 600;
  font-size: 0.88rem;
  color: #ffffff;
}
.ci-sub {
  font-weight: 600;
  font-size: 0.9rem;
  color: #ffffff;
}

.cart-footer {
  padding-top: 1rem;
  margin-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}
.total-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.8rem;
}
.total-row span:first-child {
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.total-num {
  font-size: 1.4rem;
  font-weight: 700;
  color: #b4fe2f;
  letter-spacing: -0.01em;
}
.cobrar {
  font-size: 0.95rem;
  font-weight: 600;
  min-height: 46px;
}

/* Barra Flotante Inferior */
.cart-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 50;
  background: #b4fe2f;
  color: #000000;
  cursor: pointer;
  padding: 0.7rem 1.1rem;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(180, 254, 47, 0.2);
  transition: all 0.2s ease;
}
.cart-bar-oculto {
  transform: translateY(150%) !important;
  pointer-events: none;
}
.cb-info {
  display: flex;
  flex-direction: column;
}
.cb-count {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.6;
  letter-spacing: 0.02em;
}
.cb-total {
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.01em;
}
.cb-ver {
  font-weight: 600;
  font-size: 0.85rem;
}

.cart-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 5, 9, 0.8);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 54;
}

/* Modales */
.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(4, 5, 9, 0.85);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: grid;
  place-items: center;
  z-index: 100;
  padding: 1rem;
}
.modal {
  background: #080a10;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
  width: 100%;
  max-width: 390px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.7);
}
.modal-header {
  margin-bottom: 1.25rem;
}
.modal h3 {
  font-size: 1.15rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 0.25rem 0;
}
.modal-acciones {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

.monto-input {
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 0.85rem;
  color: #b4fe2f;
  font-size: 1.6rem;
  font-weight: 700;
  text-align: center;
  margin: 0.5rem 0;
  transition: border-color 0.15s;
}
.monto-input:focus {
  outline: none;
  border-color: #b4fe2f;
}

.pago-sub {
  margin: 0 0 0.5rem 0;
  font-size: 0.78rem;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(255, 255, 255, 0.3);
}
.pago-opciones {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.pago-op {
  width: 100%;
  font-size: 0.9rem;
  min-height: 44px;
  justify-content: flex-start;
  padding-left: 1.25rem;
}
.pago-op svg {
  color: rgba(255, 255, 255, 0.6);
}

.fiado-bloque {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}
.select-cliente {
  width: 100%;
  background: #0c0e16;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 0.7rem 0.85rem;
  color: #ffffff;
  font-size: 0.88rem;
  margin-bottom: 0.75rem;
  min-height: 42px;
  outline: none;
}
.cerrar-modal {
  margin-top: 0.75rem;
  border: none;
  color: rgba(255, 255, 255, 0.3);
}
.cerrar-modal:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.02);
}

/* Transitions de Vue */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.modal-pop-enter-active,
.modal-pop-leave-active {
  transition: all 0.2s ease-out;
}
.modal-pop-enter-from,
.modal-pop-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.15s ease;
}
.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.animate-fade-in {
  animation: fadeIn 0.25s ease forwards;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ==========================================================================
   RESPONSIVE LAYOUT (ADAPTACIÓN DE PANELES EN ESCRITORIO)
   ========================================================================== */
@media (min-width: 768px) {
  .pos-body {
    display: grid;
    grid-template-columns: 1fr 340px;
    grid-template-rows: 100%;
    gap: 1rem;
  }

  .acciones {
    flex-wrap: nowrap;
  }
  .accion-btn {
    flex: initial;
  }
  .grid-prod {
    grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
    gap: 0.6rem;
  }

  .panel-cart {
    position: relative;
    transform: none !important;
    max-height: 100%;
    box-shadow: none;
    border-radius: 8px;
    z-index: 1;
    background: #080a10;
    border: 1px solid rgba(255, 255, 255, 0.04);
    padding: 1rem;
    inset: auto;
  }
  .cerrar-cart {
    display: none;
  }
  .cart-bar {
    display: none !important;
  }
  .cart-overlay {
    display: none !important;
  }
}

@media (min-width: 1200px) {
  .pos-body {
    grid-template-columns: 1fr 370px;
    gap: 1.25rem;
  }
  .grid-prod {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.7rem;
  }
}
</style>
