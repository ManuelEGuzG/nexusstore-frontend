<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { usePosStore } from '@/stores/pos'
import ComprobanteTiquete from '@/components/ComprobanteTiquete.vue'
import EscanerContinuo from '@/components/EscanerContinuo.vue'

const router = useRouter()
const pos = usePosStore()

interface Producto { id: number; nombre: string; precio: number }

const productos = ref<Producto[]>([])
const busqueda = ref('')
const enLinea = ref(navigator.onLine)

const mostrarMontoLibre = ref(false)
const mostrarPago = ref(false)
const mostrarTiquete = ref(false)
const montoLibre = ref('')
const carritoAbierto = ref(false) // panel del carrito en móvil

const mostrarEscaner = ref(false)
const escanerRef = ref<any>(null)

const clientes = ref<{ id: number; nombre: string; saldo: number }[]>([])
const clienteSeleccionado = ref<number | null>(null)

const productosFiltrados = computed(() => {
  if (!busqueda.value) return productos.value
  const q = busqueda.value.toLowerCase()
  return productos.value.filter((p) => p.nombre.toLowerCase().includes(q))
})
const totalItems = computed(() => pos.items.reduce((s, it) => s + it.cantidad, 0))

onMounted(async () => {
  await pos.refrescarPendientes()
  window.addEventListener('online', () => (enLinea.value = true))
  window.addEventListener('offline', () => (enLinea.value = false))
  try {
    const { data } = await api.get('/products')
    productos.value = data
  } catch { /* sin productos, igual se vende por monto libre */ }
})

function fmt(n: number) { return '₡' + Number(n).toLocaleString('es-CR') }

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
      pos.agregarProducto({ id: data.producto.id, nombre: data.producto.nombre, precio: Number(data.producto.precio) })
      escanerRef.value?.avisar(`+ ${data.producto.nombre}`, true)
    }
  } catch (e: any) {
    if (e.response?.status === 404) escanerRef.value?.avisar('Producto no registrado', false)
    else escanerRef.value?.avisar('Sin conexión', false)
  }
}

function ajustarCantidadEscaner(productId: number, delta: number) {
  const idx = pos.items.findIndex((it) => it.product_id === productId)
  if (idx !== -1) pos.cambiarCantidad(idx, pos.items[idx].cantidad + delta)
}

async function abrirPago() {
  if (pos.vacio) return
  try { const { data } = await api.get('/customers'); clientes.value = data } catch { clientes.value = [] }
  mostrarPago.value = true
}

const procesando = ref(false)
async function cobrar(tipo: 'efectivo' | 'fiado' | 'manual') {
  if (tipo === 'fiado' && !clienteSeleccionado.value) { alert('Seleccioná un cliente para el fiado.'); return }
  procesando.value = true
  try {
    await pos.finalizar({ tipoPago: tipo, customerId: tipo === 'fiado' ? clienteSeleccionado.value : null })
    mostrarPago.value = false
    clienteSeleccionado.value = null
    carritoAbierto.value = false
    mostrarTiquete.value = true
  } finally { procesando.value = false }
}
</script>

<template>
  <div class="pos">
    <!-- Barra superior -->
    <header class="pos-top">
      <button class="back" @click="router.push('/')">←</button>
      <strong class="pos-title">Punto de venta</strong>
      <div class="estado">
        <span class="chip" :class="enLinea ? 'on' : 'off'">{{ enLinea ? 'En línea' : 'Sin conexión' }}</span>
        <span v-if="pos.pendientes > 0" class="chip pend">{{ pos.pendientes }}</span>
      </div>
    </header>

    <div class="pos-body">
      <!-- Productos -->
      <section class="panel-prod">
        <div class="acciones">
          <input v-model="busqueda" class="buscar" type="search" placeholder="Buscar producto…" />
          <button class="btn btn-ghost accion-btn" @click="mostrarEscaner = true">Escanear</button>
          <button class="btn btn-primary accion-btn" @click="mostrarMontoLibre = true">Monto libre</button>
        </div>

        <div v-if="productosFiltrados.length" class="grid-prod">
          <button v-for="p in productosFiltrados" :key="p.id" class="prod-btn" @click="pos.agregarProducto(p)">
            <span class="prod-nombre">{{ p.nombre }}</span>
            <span class="prod-precio">{{ fmt(p.precio) }}</span>
          </button>
        </div>
        <div v-else class="vacio-prod card">
          <p class="vp-title">No hay productos cargados</p>
          <p class="dim">Podés vender por monto libre, escanear, o cargar productos.</p>
        </div>
      </section>

      <!-- Carrito (panel lateral en desktop) -->
      <section class="panel-cart card" :class="{ abierto: carritoAbierto }">
        <div class="cart-head">
          <h2>Venta actual</h2>
          <button class="cerrar-cart" @click="carritoAbierto = false">×</button>
        </div>

        <div v-if="pos.vacio" class="cart-vacio">
          <p>Carrito vacío</p>
          <p class="dim">Tocá un producto, escaneá o usá monto libre.</p>
        </div>

        <ul v-else class="cart-items">
          <li v-for="(it, i) in pos.items" :key="i" class="cart-item">
            <div class="ci-top">
              <span class="ci-desc">{{ it.descripcion }}</span>
              <button class="qx" @click="pos.quitar(i)">×</button>
            </div>
            <div class="ci-bottom">
              <div class="ci-ctrl">
                <button class="qbtn" @click="pos.cambiarCantidad(i, it.cantidad - 1)">−</button>
                <span class="qcant">{{ it.cantidad }}</span>
                <button class="qbtn" @click="pos.cambiarCantidad(i, it.cantidad + 1)">+</button>
              </div>
              <span class="ci-sub">{{ fmt(it.cantidad * it.precio_unitario - it.descuento) }}</span>
            </div>
          </li>
        </ul>

        <div class="cart-footer">
          <div class="total-row">
            <span>Total</span>
            <span class="total-num">{{ fmt(pos.total) }}</span>
          </div>
          <button class="btn btn-primary btn-block cobrar" :disabled="pos.vacio" @click="abrirPago">
            Cobrar {{ fmt(pos.total) }}
          </button>
        </div>
      </section>
    </div>

    <!-- Barra inferior del carrito (solo móvil) -->
    <div v-if="!pos.vacio" class="cart-bar" @click="carritoAbierto = true">
      <div class="cb-info">
        <span class="cb-count">{{ totalItems }} {{ totalItems === 1 ? 'ítem' : 'ítems' }}</span>
        <span class="cb-total">{{ fmt(pos.total) }}</span>
      </div>
      <span class="cb-ver">Ver venta ›</span>
    </div>

    <!-- Overlay del carrito en móvil -->
    <div v-if="carritoAbierto" class="cart-overlay" @click="carritoAbierto = false"></div>

    <!-- Monto libre -->
    <div v-if="mostrarMontoLibre" class="modal-bg" @click.self="mostrarMontoLibre = false">
      <div class="modal">
        <h3>Monto libre</h3>
        <input v-model="montoLibre" type="number" inputmode="decimal" placeholder="₡ 0" class="monto-input" @keyup.enter="confirmarMontoLibre" autofocus />
        <div class="modal-acciones">
          <button class="btn btn-ghost" @click="mostrarMontoLibre = false">Cancelar</button>
          <button class="btn btn-primary" @click="confirmarMontoLibre">Agregar</button>
        </div>
      </div>
    </div>

    <!-- Pago -->
    <div v-if="mostrarPago" class="modal-bg" @click.self="mostrarPago = false">
      <div class="modal">
        <h3>Cobrar {{ fmt(pos.total) }}</h3>
        <p class="dim pago-sub">¿Cómo paga?</p>
        <div class="pago-opciones">
          <button class="btn btn-primary pago-op" :disabled="procesando" @click="cobrar('efectivo')">Efectivo</button>
          <button class="btn btn-ghost pago-op" :disabled="procesando" @click="cobrar('manual')">SINPE / Tarjeta</button>
        </div>
        <div class="fiado-bloque">
          <p class="dim pago-sub">O a fiado:</p>
          <select v-model="clienteSeleccionado" class="select-cliente">
            <option :value="null">Elegí un cliente…</option>
            <option v-for="c in clientes" :key="c.id" :value="c.id">{{ c.nombre }} ({{ fmt(c.saldo) }})</option>
          </select>
          <button class="btn btn-ghost btn-block fiar" :disabled="procesando || !clienteSeleccionado" @click="cobrar('fiado')">Cargar a fiado</button>
        </div>
        <button class="btn btn-ghost btn-block cerrar-modal" @click="mostrarPago = false">Cancelar</button>
      </div>
    </div>

    <ComprobanteTiquete
      v-if="mostrarTiquete && pos.ultimaVenta"
      :uuid="pos.ultimaVenta.uuid" :items="pos.ultimaVenta.items"
      :total="pos.ultimaVenta.total" :forma-pago="pos.ultimaVenta.formaPago"
      :fecha="pos.ultimaVenta.fecha" @cerrar="mostrarTiquete = false" />

    <EscanerContinuo
      v-if="mostrarEscaner" ref="escanerRef" :items="pos.items"
      @leido="onCodigoLeido" @cambiar-cantidad="ajustarCantidadEscaner"
      @cerrar="mostrarEscaner = false" />
  </div>
</template>

<style scoped>
.pos { height: 100vh; height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }

.pos-top {
  display: flex; align-items: center; gap: 0.8rem;
  padding: 0.8rem clamp(0.9rem, 2vw, 1.4rem); border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.back {
  width: 42px; height: 42px; flex-shrink: 0; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: transparent; color: var(--text);
  font-size: 1.2rem; cursor: pointer;
}
.back:hover { border-color: var(--accent); }
.pos-title { font-family: var(--font-display); font-size: var(--fs-md); flex: 1; }
.estado { display: flex; gap: 0.4rem; }

.pos-body { flex: 1; display: grid; grid-template-columns: 1fr 380px; gap: 1rem; padding: clamp(0.9rem, 2vw, 1.4rem); overflow: hidden; min-height: 0; }

.panel-prod { display: flex; flex-direction: column; min-height: 0; }
.acciones { display: flex; gap: 0.6rem; margin-bottom: 1rem; flex-shrink: 0; }
.buscar {
  flex: 1; min-width: 0; background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 0.85rem 1rem; color: var(--text);
  font-size: var(--fs-base); min-height: var(--touch);
}
.buscar:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.accion-btn { flex-shrink: 0; }

.grid-prod {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.7rem; overflow-y: auto; align-content: start; padding-right: 0.3rem; min-height: 0;
}
.prod-btn {
  background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 1rem; cursor: pointer; display: flex; flex-direction: column; gap: 0.4rem;
  text-align: left; min-height: 88px; justify-content: space-between;
  transition: border-color 0.15s ease, transform 0.08s ease, background 0.15s ease;
}
.prod-btn:hover { border-color: var(--accent); background: var(--bg-hover); }
.prod-btn:active { transform: scale(0.97); }
.prod-nombre { font-weight: 600; font-size: var(--fs-sm); line-height: 1.25;color: white; }
.prod-precio { color: var(--accent); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-md); }

.vacio-prod { padding: 2.5rem 1.5rem; text-align: center; }
.vp-title { font-family: var(--font-display); font-weight: 600; font-size: var(--fs-md); margin-bottom: 0.4rem; }

/* Carrito */
.panel-cart { padding: 1.3rem; display: flex; flex-direction: column; min-height: 0; }
.cart-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.cerrar-cart { display: none; background: none; border: none; color: var(--text-dim); font-size: 1.8rem; cursor: pointer; line-height: 1; }
.cart-vacio { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 0.3rem; }
.cart-vacio p:first-child { font-family: var(--font-display); font-weight: 600; }
.cart-items { list-style: none; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.7rem; min-height: 0; padding-right: 0.2rem; }
.cart-item { background: var(--bg-elev); border-radius: var(--radius-sm); padding: 0.8rem 0.9rem; }
.ci-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.6rem; }
.ci-desc { font-weight: 500; font-size: var(--fs-sm); line-height: 1.3; }
.qx { background: none; border: none; color: var(--danger); font-size: 1.3rem; cursor: pointer; line-height: 1; flex-shrink: 0; }
.ci-bottom { display: flex; align-items: center; justify-content: space-between; }
.ci-ctrl { display: flex; align-items: center; gap: 0.5rem; }
.qbtn { width: 36px; height: 36px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text); font-size: 1.3rem; cursor: pointer; display: grid; place-items: center; }
.qbtn:hover { border-color: var(--accent); }
.qcant { min-width: 30px; text-align: center; font-weight: 700; font-family: var(--font-display); }
.ci-sub { font-weight: 600; }
.cart-footer { padding-top: 1rem; margin-top: 0.6rem; border-top: 1px solid var(--border); flex-shrink: 0; }
.total-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.9rem; }
.total-row span:first-child { color: var(--text-dim); }
.total-num { font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 800; color: var(--accent); }
.cobrar { font-size: var(--fs-md); min-height: 58px; }

/* Barra inferior móvil (oculta en desktop) */
.cart-bar { display: none; }
.cart-overlay { display: none; }

.monto-input {
  width: 100%; background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 1rem; color: var(--text); font-size: var(--fs-xl); font-family: var(--font-display);
  text-align: center; margin: 1rem 0;
}
.monto-input:focus { outline: none; border-color: var(--accent); }
.pago-sub { margin: 0.9rem 0 0.6rem; font-size: var(--fs-sm); }
.pago-opciones { display: flex; flex-direction: column; gap: 0.6rem; }
.pago-op { width: 100%; font-size: var(--fs-md); min-height: 56px; }
.fiado-bloque { margin-top: 1.2rem; padding-top: 1.2rem; border-top: 1px solid var(--border); }
.select-cliente { width: 100%; background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.85rem; color: var(--text); font-size: var(--fs-base); margin-bottom: 0.7rem; min-height: var(--touch); }
.fiar:not(:disabled):hover { border-color: var(--warn); }
.cerrar-modal { margin-top: 1rem; }

/* ====================== MÓVIL ====================== */
@media (max-width: 760px) {
  .pos-body { grid-template-columns: 1fr; padding-bottom: 5.5rem; }

  /* El carrito se vuelve un panel deslizante desde abajo */
  .panel-cart {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 55;
    max-height: 82vh; border-radius: var(--radius) var(--radius) 0 0;
    transform: translateY(110%); transition: transform 0.28s ease;
    box-shadow: 0 -10px 40px rgba(0,0,0,0.5);
  }
  .panel-cart.abierto { transform: translateY(0); }
  .cerrar-cart { display: block; }

  /* Barra inferior fija con total y acceso al carrito */
  .cart-bar {
    display: flex; align-items: center; justify-content: space-between;
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
    background: var(--accent); color: #11140a; cursor: pointer;
    padding: 0.9rem 1.3rem; box-shadow: 0 -6px 24px rgba(0,0,0,0.35);
  }
  .cb-info { display: flex; flex-direction: column; }
  .cb-count { font-size: var(--fs-xs); font-weight: 600; opacity: 0.8; }
  .cb-total { font-family: var(--font-display); font-weight: 800; font-size: var(--fs-md); }
  .cb-ver { font-family: var(--font-display); font-weight: 700; }

  .cart-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 54; }
}
</style>