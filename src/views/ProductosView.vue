<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import EscanerCodigo from '@/components/EscanerCodigo.vue'

const router = useRouter()

interface Producto {
  id: number
  nombre: string
  precio: number
  costo?: number
  stock_actual: number
  sku?: string
  barcode?: string
  categoria?: string
}

const productos = ref<Producto[]>([])
const cargando = ref(true)
const busqueda = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Control de la pestaña activa: 'todos' o 'criticos'
const pestanaActiva = ref<'todos' | 'criticos'>('todos')

const mostrarForm = ref(false)
const editando = ref<Producto | null>(null)

// Campos del formulario
const fNombre = ref('')
const fPrecio = ref('')
const fCosto = ref('')
const fStock = ref('')
const fBarcode = ref('')

const mostrarEscaner = ref(false)
const modoEscaner = ref<'campo' | 'buscar'>('campo')

// Alerta e inclusión en pestaña crítica si tiene 10 unidades o menos
const productosCriticos = computed(() => {
  return productos.value.filter((p) => p.stock_actual <= 10)
})

// Decidir qué lista mostrar según la pestaña activa
const productosFiltrados = computed(() => {
  if (pestanaActiva.value === 'criticos') {
    return productosCriticos.value
  }
  return productos.value
})

function fmt(n: number) {
  return (
    '₡' +
    Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  )
}

// Función para formatear el stock de forma inteligente
function fmtStock(n: number): string {
  const numero = Number(n || 0)
  if (numero % 1 === 0) {
    return numero.toFixed(0)
  }
  return parseFloat(numero.toFixed(2)).toString()
}

async function cargar() {
  cargando.value = true
  try {
    const { data } = await api.get('/products', { params: { q: busqueda.value.trim() } })
    productos.value = data || []
  } catch {
    console.warn('Excepción de red: No se pudo sincronizar el catálogo de artículos.')
  } finally {
    cargando.value = false
  }
}

function handleBusqueda() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    cargar()
  }, 250)
}

onMounted(cargar)

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

function resetForm() {
  editando.value = null
  fNombre.value = ''
  fPrecio.value = ''
  fCosto.value = ''
  fStock.value = ''
  fBarcode.value = ''
}

async function abrirModal(p?: Producto) {
  if (p) {
    editando.value = p
    fNombre.value = p.nombre
    fPrecio.value = String(p.precio)
    fCosto.value = p.costo != null ? String(p.costo) : ''
    fStock.value = fmtStock(p.stock_actual)
    fBarcode.value = p.barcode || ''
  } else {
    resetForm()
  }

  mostrarForm.value = true

  await nextTick()
  document.getElementById('f-nombre')?.focus()
}

function cerrarModal() {
  mostrarForm.value = false
  resetForm()
}

async function guardar() {
  if (!fNombre.value.trim() || !fPrecio.value) return

  const nuevoStock = fStock.value !== '' ? parseFloat(fStock.value) : 0

  const payload: any = {
    nombre: fNombre.value.trim(),
    precio: parseFloat(fPrecio.value) || 0,
    barcode: fBarcode.value.trim() || null,
  }

  const costoAnalizado = parseFloat(fCosto.value)
  payload.costo = !Number.isNaN(costoAnalizado) && fCosto.value !== '' ? costoAnalizado : null

  try {
    if (editando.value) {
      const peticiones = [api.put(`/products/${editando.value.id}`, payload)]

      if (nuevoStock !== editando.value.stock_actual) {
        peticiones.push(
          api.post(`/products/${editando.value.id}/ajustar-stock`, {
            tipo: 'ajuste',
            cantidad: nuevoStock,
            referencia: 'Corrección desde catálogo de artículos',
          }),
        )
      }

      await Promise.all(peticiones)
    } else {
      payload.stock_actual = nuevoStock
      await api.post('/products', payload)
    }

    cerrarModal()
    await cargar()
  } catch {
    alert('Error transaccional al intentar procesar el registro del artículo.')
  }
}

async function eliminar(p: Producto) {
  if (!window.confirm(`¿Confirmar la baja definitiva del producto: "${p.nombre}"?`)) return
  try {
    await api.delete(`/products/${p.id}`)
    await cargar()
  } catch {
    alert(
      'Restricción de seguridad: No fue posible eliminar el registro. Verifique dependencias operativas.',
    )
  }
}

function margenForm(): string {
  const precio = parseFloat(fPrecio.value)
  const costo = parseFloat(fCosto.value)
  if (Number.isNaN(precio) || Number.isNaN(costo) || costo <= 0 || precio <= costo) return ''
  const margen = ((precio - costo) / precio) * 100
  const ganancia = precio - costo
  return `Margen operativo: +${fmt(ganancia)} por unidad (${margen.toFixed(0)}% de utilidad)`
}

function escanearParaCampo() {
  modoEscaner.value = 'campo'
  mostrarEscaner.value = true
}

function escanearParaBuscar() {
  modoEscaner.value = 'buscar'
  mostrarEscaner.value = true
}

async function onCodigoLeido(codigo: string) {
  mostrarEscaner.value = false
  if (modoEscaner.value === 'campo') {
    fBarcode.value = codigo
  } else {
    try {
      const { data } = await api.get(`/products/buscar/${codigo}`)
      if (data?.encontrado && data.producto) {
        abrirModal(data.producto)
      }
    } catch (e: any) {
      if (e.response?.status === 404) {
        alert(`Auditoría: No se encontró ningún artículo indexado con el código [${codigo}].`)
      } else {
        alert('Error de conectividad en la verificación remota del identificador.')
      }
    }
  }
}
</script>

<template>
  <main class="page fade-up" role="main">
    <header class="page-head">
      <div class="head-left">
        <button class="back" @click="router.push('/')" aria-label="Regresar al panel de control">
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
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h1>Productos</h1>
      </div>
      <div class="head-acciones">
        <button
          type="button"
          class="btn btn-ghost mini-btn"
          @click="escanearParaBuscar"
          title="Escanear Código"
        >
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
            aria-hidden="true"
          >
            <path d="M21 2v6h-6m6-6l-7.5 7.5M3 22v-6h6m-6 6l7.5-7.5"></path>
          </svg>
          <span class="lbl-btn">Escanear</span>
        </button>
        <button type="button" class="btn btn-primary mini-btn" @click="abrirModal()">
          <span>+ <span class="lbl-btn">Agregar</span></span>
        </button>
      </div>
    </header>

    <div class="tabs-container">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: pestanaActiva === 'todos' }"
        @click="pestanaActiva = 'todos'"
      >
        Todos los artículos
        <span class="tab-badge count-normal">{{ productos.length }}</span>
      </button>

      <button
        type="button"
        class="tab-btn"
        :class="{
          active: pestanaActiva === 'criticos',
          'has-criticos': productosCriticos.length > 0,
        }"
        @click="pestanaActiva = 'criticos'"
      >
        Stock Bajo
        <span v-if="productosCriticos.length" class="tab-badge count-critico">
          {{ productosCriticos.length }}
        </span>
      </button>
    </div>

    <div class="search-container">
      <div class="search-wrapper">
        <svg
          class="search-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          v-model="busqueda"
          class="inp search-inp"
          type="search"
          placeholder="Buscar descripción, código o SKU…"
          aria-label="Búsqueda de productos"
          @input="handleBusqueda"
        />
      </div>
    </div>

    <div class="state-msg" v-if="cargando" aria-live="polite">
      <p class="text-pulse">Sincronizando maestro de inventario…</p>
    </div>

    <div class="vacio card animate-fade-in" v-else-if="!productosFiltrados.length" role="status">
      <svg
        class="vacio-icono"
        xmlns="http://www.w3.org/2000/svg"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line>
        <polygon points="12 22.08 12 12 3 6.92 3 17.08 12 22.08"></polygon>
        <polygon points="12 12 21 6.92 21 17.08 12 22.08 12 12"></polygon>
        <polygon points="12 12 3 6.92 12 1.84 21 6.92 12 12"></polygon>
      </svg>
      <p class="v-title">Sin registros</p>
      <p class="dim">
        {{
          pestanaActiva === 'criticos'
            ? '¡Excelente! No hay ningún artículo con stock bajo.'
            : 'Ningún artículo coincide con los criterios de búsqueda o el catálogo está vacío.'
        }}
      </p>
    </div>

    <ul class="lista-productos" v-else role="list">
      <li
        v-for="p in productosFiltrados"
        :key="p.id"
        class="card item-prod"
        tabindex="0"
        role="listitem"
        @click="abrirModal(p)"
        @keydown.enter="abrirModal(p)"
      >
        <div class="p-info">
          <span class="p-nombre">{{ p.nombre }}</span>
          <div class="p-meta">
            <span class="meta-tag precio-tag">{{ fmt(p.precio) }}</span>
            <span class="meta-tag costo-tag" v-if="p.costo">Costo: {{ fmt(p.costo) }}</span>

            <span class="meta-tag stock-tag" :class="{ 'low-stock': p.stock_actual <= 10 }">
              {{ p.stock_actual <= 0 ? 'Sin stock' : `${fmtStock(p.stock_actual)} u.` }}
            </span>

            <span class="meta-tag barcode-tag muted" v-if="p.barcode">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                style="display: inline; margin-right: 3px; vertical-align: middle"
                aria-hidden="true"
              >
                <line x1="3" y1="5" x2="3" y2="19"></line>
                <line x1="6" y1="5" x2="6" y2="19"></line>
                <line x1="10" y1="5" x2="10" y2="19"></line>
                <line x1="14" y1="5" x2="14" y2="19"></line>
                <line x1="17" y1="5" x2="17" y2="19"></line>
                <line x1="21" y1="5" x2="21" y2="19"></line>
              </svg>
              {{ p.barcode }}
            </span>
          </div>
        </div>
        <button
          type="button"
          class="btn-del"
          @click.stop="eliminar(p)"
          title="Eliminar del catálogo"
          aria-label="Eliminar artículo"
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
            aria-hidden="true"
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path
              d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            ></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="mostrarForm"
        class="modal-bg"
        @click.self="cerrarModal"
        @keydown.escape="cerrarModal"
        tabindex="-1"
      >
        <div
          class="modal card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-product-title"
        >
          <h3 id="modal-product-title">{{ editando ? 'Modificar' : 'Registrar' }} Producto</h3>

          <form @submit.prevent="guardar">
            <div class="field">
              <label for="f-nombre">Descripción del Artículo</label>
              <input
                id="f-nombre"
                v-model="fNombre"
                placeholder="Ej. Líquido Purificado 600ml"
                required
                autocomplete="off"
              />
            </div>

            <div class="form-row">
              <div class="field">
                <label for="f-precio">Precio de Venta</label>
                <input
                  id="f-precio"
                  v-model="fPrecio"
                  type="number"
                  step="any"
                  min="0"
                  inputmode="decimal"
                  placeholder="₡0"
                  required
                />
              </div>
              <div class="field">
                <label for="f-costo">Costo Base</label>
                <input
                  id="f-costo"
                  v-model="fCosto"
                  type="number"
                  step="any"
                  min="0"
                  inputmode="decimal"
                  placeholder="Opcional"
                />
              </div>
            </div>

            <p class="margen-hint ok-text" v-if="margenForm()" role="status">{{ margenForm() }}</p>

            <div class="field">
              <label for="f-stock">Existencia Actual</label>
              <input
                id="f-stock"
                v-model="fStock"
                type="number"
                step="any"
                inputmode="decimal"
                placeholder="0"
                required
              />
            </div>

            <div class="field">
              <label for="f-barcode">Código de Barras (EAN/UPC)</label>
              <div class="barcode-row">
                <input
                  id="f-barcode"
                  v-model="fBarcode"
                  placeholder="Identificador numérico"
                  autocomplete="off"
                />
                <button
                  type="button"
                  class="btn-ghost scan-embedded-btn"
                  @click="escanearParaCampo"
                >
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
                    <path d="M21 2v6h-6m6-6l-7.5 7.5M3 22v-6h6m-6 6l7.5-7.5"></path>
                  </svg>
                  <span>Escanear</span>
                </button>
              </div>
            </div>

            <div class="modal-acciones">
              <button type="button" class="btn btn-ghost" @click="cerrarModal">Cancelar</button>
              <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <EscanerCodigo
        v-if="mostrarEscaner"
        class="escaner-supremo"
        @leido="onCodigoLeido"
        @cerrar="mostrarEscaner = false"
      />
    </Teleport>
  </main>
</template>

<style scoped>
.page {
  padding: 1rem 0.5rem 3rem;
  max-width: 900px;
  margin: 0 auto;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;
}

/* Cabecera Estructurada */
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;
  gap: 0.5rem;
  width: 100%;
}
.head-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  flex: 1;
}
.page-head h1 {
  font-size: clamp(1.1rem, 4.5vw, 1.5rem);
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.back {
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
  transition: all 0.2s;
}
.back:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.head-acciones {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

.mini-btn {
  padding: 0 0.6rem;
  font-size: 0.8rem;
  font-weight: 600;
  border-radius: 6px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

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
  transition: all 0.2s;
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #ffffff;
}

/* SISTEMA DE PESTAÑAS (TABS) EXCLUSIVO */
.tabs-container {
  display: flex;
  gap: 0.3rem;
  background: #05060a;
  padding: 0.25rem;
  border-radius: 8px;
  margin-bottom: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.03);
}
.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: transparent;
  border: none;
  color: #64748b;
  padding: 0.6rem;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.tab-btn:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.02);
}
.tab-btn.active {
  background: #090b11;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.03);
}
.tab-badge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 10px;
}
.count-normal {
  background: rgba(255, 255, 255, 0.05);
  color: #94a3b8;
}
.tab-btn.active .count-normal {
  background: rgba(180, 254, 47, 0.1);
  color: #b4fe2f;
}
.count-critico {
  background: #ef4444;
  color: #ffffff;
  animation: pulseScale 2s infinite;
}
@keyframes pulseScale {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}

/* Contenedor de Búsqueda */
.search-container {
  margin-bottom: 1.2rem;
}
.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 12px;
  color: #64748b;
  pointer-events: none;
}
.inp {
  width: 100%;
  background: #090b11;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 0.65rem 0.8rem;
  color: #ffffff;
  font-size: 0.88rem;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.search-inp {
  padding-left: 2.3rem;
}
.inp:focus {
  outline: none;
  border-color: #b4fe2f;
}

/* Estados de Carga y Vacío */
.state-msg {
  text-align: center;
  padding: 2rem 0;
  color: #64748b;
  font-size: 0.9rem;
}
.text-pulse {
  animation: pulseOpacity 1.5s ease-in-out infinite;
  margin: 0;
}
@keyframes pulseOpacity {
  50% {
    opacity: 0.5;
  }
}

.vacio {
  padding: 3rem 1rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #080a10;
  border: 1px dashed rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}
.vacio-icono {
  color: rgba(255, 255, 255, 0.15);
  margin-bottom: 0.75rem;
}
.v-title {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.25rem;
  color: #ffffff;
}
.dim {
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.8rem;
  line-height: 1.4;
  margin: 0;
  max-width: 320px;
}

/* Listado de Productos */
.lista-productos {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.card {
  background: #090b11;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}

.item-prod {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 0.9rem;
  gap: 0.75rem;
  outline: none;
  cursor: pointer;
  min-width: 0;
  transition: all 0.2s ease;
}
.item-prod:hover,
.item-prod:focus-visible {
  border-color: rgba(180, 254, 47, 0.2);
  background: #0d101a;
}

.p-info {
  flex: 1;
  min-width: 0;
}
.p-nombre {
  font-weight: 600;
  font-size: 0.92rem;
  color: #ffffff;
  display: block;
  margin-bottom: 0.3rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.6rem;
  align-items: center;
}
.meta-tag {
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
}
.precio-tag {
  color: #b4fe2f;
  font-weight: 700;
  font-size: 0.85rem;
}
.costo-tag {
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding-left: 0.5rem;
}
.stock-tag {
  background: rgba(255, 255, 255, 0.02);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  font-weight: 500;
  color: #cbd5e1;
}
.low-stock {
  color: #f87171;
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.12);
}

.btn-del {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.15);
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  transition: all 0.2s;
  flex-shrink: 0;
}
.btn-del:hover {
  color: #f87171;
  background: rgba(239, 68, 68, 0.08);
}

/* Formularios del Modal */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.9rem;
}
.field label {
  color: #cbd5e1;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.field input {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  color: #ffffff;
  font-size: 0.88rem;
  min-width: 0;
  transition: border-color 0.2s;
}
.field input:focus {
  outline: none;
  border-color: #b4fe2f;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
}
.margen-hint {
  font-size: 0.78rem;
  margin: -0.4rem 0 0.9rem 0;
  font-weight: 600;
}
.ok-text {
  color: #4ade80;
}

.barcode-row {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
.barcode-row input {
  flex: 1;
}
.scan-embedded-btn {
  height: 36px;
  padding: 0 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.02);
}

/* Arquitectura Modal Ultra-Móvil */
.modal-bg {
  position: fixed;
  inset: 0 !important;
  width: 100vw;
  height: 100vh;
  background: rgba(5, 6, 10, 0.85);
  display: grid;
  place-items: center;
  padding: 0.75rem;
  box-sizing: border-box;
  z-index: 99999 !important;
  backdrop-filter: blur(4px);
}
.modal {
  width: 100%;
  max-width: 440px;
  padding: 1.25rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
  background: #080a10;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.modal h3 {
  margin: 0 0 1rem 0;
  font-size: 1.1rem;
  color: #ffffff;
  font-weight: 700;
}
.modal-acciones {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.2rem;
}
.modal-acciones .btn {
  height: 38px;
  font-weight: 600;
  padding: 0 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
}

.escaner-supremo {
  position: fixed !important;
  inset: 0 !important;
  z-index: 1000000 !important;
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

/* Scrollbars */
.criticos-scroll::-webkit-scrollbar {
  width: 4px;
}
.criticos-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.criticos-scroll::-webkit-scrollbar-thumb {
  background: rgba(239, 68, 68, 0.2);
  border-radius: 2px;
}

/* ====================== RESPONSIVIDAD MÓVIL ====================== */
@media (max-width: 480px) {
  .lbl-btn {
    display: none;
  }
  .mini-btn {
    width: 36px;
    padding: 0;
    justify-content: center;
  }

  .form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .barcode-row {
    align-items: stretch;
  }
  .scan-embedded-btn {
    height: 36px;
  }
}

@media (min-width: 600px) {
  .page {
    padding: 1.5rem 1rem 4rem;
  }
  .page-head {
    margin-bottom: 1.5rem;
    gap: 1rem;
  }
  .page-head h1 {
    font-size: 1.6rem;
  }
  .back {
    width: 38px;
    height: 38px;
  }
  .mini-btn {
    padding: 0 0.9rem;
    height: 38px;
    font-size: 0.85rem;
    gap: 0.4rem;
  }
  .search-container {
    margin-bottom: 1.5rem;
  }
  .inp {
    padding: 0.75rem 1rem;
    font-size: 0.92rem;
  }
  .search-inp {
    padding-left: 2.6rem;
  }
  .lista-productos {
    gap: 0.5rem;
  }
  .item-prod {
    padding: 1rem 1.2rem;
    gap: 1rem;
  }
  .p-nombre {
    font-size: 1rem;
    margin-bottom: 0.4rem;
  }
  .p-meta {
    gap: 0.5rem 0.8rem;
  }
  .meta-tag {
    font-size: 0.8rem;
  }
  .precio-tag {
    font-size: 0.9rem;
  }
  .modal {
    padding: 1.8rem;
  }
  .modal h3 {
    font-size: 1.25rem;
    margin-bottom: 1.4rem;
  }
  .form-row {
    gap: 1rem;
  }
  .field {
    margin-bottom: 1.1rem;
  }
  .modal-acciones {
    gap: 0.75rem;
    margin-top: 1.5rem;
  }
}
</style>
