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
    <header class="pos-top">
      <button class="back" @click="router.push('/')">←</button>
      <strong class="pos-title">Punto de venta</strong>
      <div class="estado">
        <span class="chip" :class="enLinea ? 'on' : 'off'">{{ enLinea ? 'En línea' : 'Sin conexión' }}</span>
        <span v-if="pos.pendientes > 0" class="chip pend">{{ pos.pendientes }}</span>
      </div>
    </header>

    <div class="pos-body">
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

    <div v-if="!pos.vacio" class="cart-bar" @click="carritoAbierto = true">
      <div class="cb-info">
        <span class="cb-count">{{ totalItems }} {{ totalItems === 1 ? 'ítem' : 'ítems' }}</span>
        <span class="cb-total">{{ fmt(pos.total) }}</span>
      </div>
      <span class="cb-ver">Ver venta ›</span>
    </div>

    <div v-if="carritoAbierto" class="cart-overlay" @click="carritoAbierto = false"></div>

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
/* Estructura Base Base (Móvil Primero para estabilidad) */
.pos { 
  height: 100vh; 
  height: 100dvh; 
  display: flex; 
  flex-direction: column; 
  overflow: hidden; 
}

.pos-top {
  display: flex; 
  align-items: center; 
  gap: 0.8rem;
  padding: 0.8rem clamp(0.9rem, 2vw, 1.4rem); 
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.back {
  width: 42px; 
  height: 42px; 
  flex-shrink: 0; 
  border-radius: var(--radius-sm);
  border: 1px solid var(--border); 
  background: transparent; 
  color: var(--text);
  font-size: 1.2rem; 
  cursor: pointer;
  display: inline-grid;
  place-items: center;
}
.back:hover { border-color: var(--accent); }
.pos-title { font-family: var(--font-display); font-size: var(--fs-md); flex: 1; }
.estado { display: flex; gap: 0.4rem; align-items: center; }

/* El cuerpo por defecto en móvil se apila verticalmente */
.pos-body { 
  flex: 1; 
  display: flex;
  flex-direction: column;
  gap: 1rem; 
  padding: clamp(0.9rem, 2vw, 1.4rem); 
  overflow: hidden; 
  min-height: 0; 
}

.panel-prod { 
  flex: 1;
  display: flex; 
  flex-direction: column; 
  min-height: 0; 
}

/* Acciones fluidas en móvil para evitar desbordes */
.acciones { 
  display: flex; 
  gap: 0.5rem; 
  margin-bottom: 1rem; 
  flex-shrink: 0; 
  flex-wrap: wrap; /* Permite saltar de línea en pantallas super chicas como un iPhone SE */
}

.buscar {
  flex: 1; 
  min-width: 140px; 
  background: var(--bg-elev); 
  border: 1px solid var(--border);
  border-radius: var(--radius-sm); 
  padding: 0.75rem 0.9rem; 
  color: var(--text);
  font-size: var(--fs-base); 
  min-height: var(--touch);
}
.buscar:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

.accion-btn { 
  flex: 1; /* Hace que compartan el espacio sobrante equitativamente en móvil */
  min-width: 95px;
  white-space: nowrap;
}

/* Grid adaptable: 2 columnas mínimo en móviles normales, escala solo en pantallas grandes */
.grid-prod {
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.6rem; 
  overflow-y: auto; 
  align-content: start; 
  padding-right: 0.3rem; 
  min-height: 0;
  flex: 1;
}

.prod-btn {
  background: var(--bg-card); 
  border: 1px solid var(--border); 
  border-radius: var(--radius-sm);
  padding: 0.85rem; 
  cursor: pointer; 
  display: flex; 
  flex-direction: column; 
  gap: 0.4rem;
  text-align: left; 
  min-height: 92px; 
  justify-content: space-between;
  transition: border-color 0.15s ease, transform 0.08s ease, background 0.15s ease;
}
.prod-btn:hover { border-color: var(--accent); background: var(--bg-hover); }
.prod-btn:active { transform: scale(0.97); }
.prod-nombre { font-weight: 600; font-size: var(--fs-sm); line-height: 1.25; color: white; }
.prod-precio { color: var(--accent); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-md); }

.vacio-prod { padding: 2.5rem 1.5rem; text-align: center; }
.vp-title { font-family: var(--font-display); font-weight: 600; font-size: var(--fs-md); margin-bottom: 0.4rem; }

/* Carrito Estilo Drawer (Móvil por defecto) */
.panel-cart { 
  padding: 1.3rem; 
  display: flex; 
  flex-direction: column; 
  min-height: 0; 
  position: fixed; 
  left: 0; 
  right: 0; 
  bottom: 0; 
  z-index: 55;
  max-height: 85vh; 
  border-radius: var(--radius) var(--radius) 0 0;
  transform: translateY(110%); 
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 -10px 40px rgba(0,0,0,0.55);
  background: var(--bg-card);
}
.panel-cart.abierto { transform: translateY(0); }
.cart-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.cerrar-cart { display: block; background: none; border: none; color: var(--text-dim); font-size: 1.8rem; cursor: pointer; line-height: 1; padding: 0.2rem; }

.cart-vacio { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 0.3rem; padding: 2rem 0; }
.cart-vacio p:first-child { font-family: var(--font-display); font-weight: 600; }

.cart-items { list-style: none; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem; min-height: 0; padding-right: 0.2rem; }
.cart-item { background: var(--bg-elev); border-radius: var(--radius-sm); padding: 0.75rem 0.85rem; }
.ci-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; }
.ci-desc { font-weight: 500; font-size: var(--fs-sm); line-height: 1.3; }
.qx { background: none; border: none; color: var(--danger); font-size: 1.3rem; cursor: pointer; line-height: 1; flex-shrink: 0; padding: 0.1rem 0.3rem; }
.ci-bottom { display: flex; align-items: center; justify-content: space-between; }
.ci-ctrl { display: flex; align-items: center; gap: 0.5rem; }
.qbtn { width: 36px; height: 36px; border-radius: 9px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text); font-size: 1.3rem; cursor: pointer; display: grid; place-items: center; }
.qbtn:hover { border-color: var(--accent); }
.qcant { min-width: 26px; text-align: center; font-weight: 700; font-family: var(--font-display); }
.ci-sub { font-weight: 600; font-size: var(--fs-sm); }

.cart-footer { padding-top: 0.9rem; margin-top: 0.5rem; border-top: 1px solid var(--border); flex-shrink: 0; }
.total-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.8rem; }
.total-row span:first-child { color: var(--text-dim); }
.total-num { font-family: var(--font-display); font-size: var(--fs-xl); font-weight: 800; color: var(--accent); }
.cobrar { font-size: var(--fs-md); min-height: 54px; }

/* Barra inferior móvil fija activa */
.cart-bar { 
  display: flex; 
  align-items: center; 
  justify-content: space-between;
  position: fixed; 
  left: 0; 
  right: 0; 
  bottom: 0; 
  z-index: 50;
  background: var(--accent); 
  color: #11140a; 
  cursor: pointer;
  padding: 0.85rem 1.2rem; 
  box-shadow: 0 -6px 24px rgba(0,0,0,0.35);
}
.cb-info { display: flex; flex-direction: column; }
.cb-count { font-size: var(--fs-xs); font-weight: 600; opacity: 0.8; }
.cb-total { font-family: var(--font-display); font-weight: 800; font-size: var(--fs-md); }
.cb-ver { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); }

.cart-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 54; }

/* Modales Optimizados y Seguros para Móviles */
.modal-bg {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: grid; place-items: center; z-index: 100; padding: 1rem;
}
.modal {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 1.5rem; width: 100%;
  max-width: 420px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);
}
.modal h3 { font-family: var(--font-display); font-size: var(--fs-lg); margin-bottom: 0.5rem; }
.modal-acciones { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1rem; }

.monto-input {
  width: 100%; background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius-sm);
  padding: 0.85rem; color: var(--text); font-size: var(--fs-xl); font-family: var(--font-display);
  text-align: center; margin: 1rem 0;
}
.monto-input:focus { outline: none; border-color: var(--accent); }
.pago-sub { margin: 0.8rem 0 0.5rem; font-size: var(--fs-sm); }
.pago-opciones { display: flex; flex-direction: column; gap: 0.6rem; }
.pago-op { width: 100%; font-size: var(--fs-md); min-height: 52px; }
.fiado-bloque { margin-top: 1.1rem; padding-top: 1.1rem; border-top: 1px solid var(--border); }
.select-cliente { width: 100%; background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.8rem; color: var(--text); font-size: var(--fs-base); margin-bottom: 0.6rem; min-height: var(--touch); }
.fiar:not(:disabled):hover { border-color: var(--warn); }
.cerrar-modal { margin-top: 0.8rem; }

/* ====================== DESKTOP / MONITOR / TABLET HORIZONTAL ====================== */
@media (min-width: 761px) {
  .pos-body { 
    display: grid; 
    grid-template-columns: 1fr 360px; 
    grid-template-rows: 100%;
    gap: 1.2rem; 
  }

  .acciones { 
    flex-wrap: nowrap; 
  }
  .accion-btn { 
    flex: initial; 
  }

  .grid-prod {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.7rem;
  }

  /* El carrito se vuelve panel estático lateral derecho */
  .panel-cart {
    position: relative;
    transform: none;
    max-height: 100%;
    box-shadow: none;
    border-radius: var(--radius);
    z-index: auto;
  }
  .cerrar-cart { display: none; }

  /* Ocultamos elementos móviles */
  .cart-bar { display: none !important; }
  .cart-overlay { display: none !important; }
}
</style>