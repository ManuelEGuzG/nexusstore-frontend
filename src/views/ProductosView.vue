<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
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

function fmt(n: number) { 
  return '₡' + Number(n).toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) 
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
    fStock.value = String(p.stock_actual)
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

  const payload: any = {
    nombre: fNombre.value.trim(),
    precio: parseFloat(fPrecio.value) || 0,
    stock_actual: parseFloat(fStock.value) || 0,
    barcode: fBarcode.value.trim() || null,
  }
  
  const costoAnalizado = parseFloat(fCosto.value)
  payload.costo = (!Number.isNaN(costoAnalizado) && fCosto.value !== '') ? costoAnalizado : null

  try {
    if (editando.value) {
      await api.put(`/products/${editando.value.id}`, payload)
    } else {
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
    alert('Restricción de seguridad: No fue posible eliminar el registro. Verifique dependencias operativas.')
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
      <button class="back" @click="router.push('/')" aria-label="Regresar al panel de control">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      </button>
      <h1>Catálogo de Productos</h1>
      <div class="head-acciones">
        <button type="button" class="btn btn-ghost mini-btn" @click="escanearParaBuscar">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 2v6h-6m6-6l-7.5 7.5M3 22v-6h6m-6 6l7.5-7.5"></path></svg>
          Escanear
        </button>
        <button type="button" class="btn btn-primary mini-btn" @click="abrirModal()">
          + Agregar Artículo
        </button>
      </div>
    </header>

    <div class="search-container">
      <div class="search-wrapper">
        <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input 
          v-model="busqueda" 
          class="inp search-inp" 
          type="search"
          placeholder="Filtrar por descripción, código de barras o SKU…" 
          aria-label="Búsqueda de productos"
          @input="handleBusqueda" 
        />
      </div>
    </div>

    <div v-if="cargando" class="state-msg" aria-live="polite">
      <p class="text-pulse">Sincronizando maestro de inventario…</p>
    </div>
    
    <div v-else-if="!productos.length" class="vacio card animate-fade-in" role="status">
      <svg class="vacio-icono" xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><polygon points="12 22.08 12 12 3 6.92 3 17.08 12 22.08"></polygon><polygon points="12 12 21 6.92 21 17.08 12 22.08 12 12"></polygon><polygon points="12 12 3 6.92 12 1.84 21 6.92 12 12"></polygon></svg>
      <p class="v-title">Catálogo no disponible</p>
      <p class="dim">Ningún artículo coincide con los criterios de búsqueda o el inventario está vacío.</p>
    </div>

    <ul v-else class="lista-productos" role="list">
      <li 
        v-for="p in productos" 
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
            <span v-if="p.costo" class="meta-tag costo-tag">Costo: {{ fmt(p.costo) }}</span>
            <span class="meta-tag stock-tag" :class="{ 'low-stock': p.stock_actual <= 0 }">
              {{ p.stock_actual <= 0 ? 'Sin Existencia' : `Existencia: ${p.stock_actual} u.` }}
            </span>
            <span v-if="p.barcode" class="meta-tag barcode-tag muted">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:3px; vertical-align:middle;" aria-hidden="true"><line x1="3" y1="5" x2="3" y2="19"></line><line x1="6" y1="5" x2="6" y2="19"></line><line x1="10" y1="5" x2="10" y2="19"></line><line x1="14" y1="5" x2="14" y2="19"></line><line x1="17" y1="5" x2="17" y2="19"></line><line x1="21" y1="5" x2="21" y2="19"></line></svg>
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </li>
    </ul>

    <Teleport to="body">
      <div v-if="mostrarForm" class="modal-bg" @click.self="cerrarModal" @keydown.escape="cerrarModal" tabindex="-1">
        <div class="modal card" role="dialog" aria-modal="true" aria-labelledby="modal-product-title">
          <h3 id="modal-product-title">{{ editando ? 'Modificar Registro de' : 'Registrar Nuevo' }} Producto</h3>
          
          <form @submit.prevent="guardar">
            <div class="field">
              <label for="f-nombre">Descripción del Artículo</label>
              <input id="f-nombre" v-model="fNombre" placeholder="Ej. Líquido Purificado 600ml" required autocomplete="off" />
            </div>
            
            <div class="form-row">
              <div class="field">
                <label for="f-precio">Precio de Venta</label>
                <input id="f-precio" v-model="fPrecio" type="number" step="any" min="0" inputmode="decimal" placeholder="₡0" required />
              </div>
              <div class="field">
                <label for="f-costo">Costo Unitario Base</label>
                <input id="f-costo" v-model="fCosto" type="number" step="any" min="0" inputmode="decimal" placeholder="Opcional" />
              </div>
            </div>
            
            <p v-if="margenForm()" class="margen-hint ok-text" role="status">{{ margenForm() }}</p>
            
            <div class="field">
              <label for="f-stock">Inventario Inicial (Existencia)</label>
              <input id="f-stock" v-model="fStock" type="number" step="any" inputmode="decimal" placeholder="0" required />
            </div>
            
            <div class="field">
              <label for="f-barcode">Código de Barras Universal (EAN/UPC)</label>
              <div class="barcode-row">
                <input id="f-barcode" v-model="fBarcode" placeholder="Ingrese o escanee el identificador" autocomplete="off" />
                <button type="button" class="btn btn-ghost mini-scan" @click="escanearParaCampo">
                  Escanear
                </button>
              </div>
            </div>
            
            <div class="modal-acciones">
              <button type="button" class="btn btn-ghost" @click="cerrarModal">Cancelar</button>
              <button type="submit" class="btn btn-primary">Confirmar Guardado</button>
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
  padding: clamp(1rem, 3vw, 2rem);
  max-width: 900px;
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
  font-size: 1.1rem;
  transition: all 0.2s;
}

.back:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.head-acciones {
  display: flex;
  gap: 0.5rem;
}

.mini-btn {
  padding: 0.5rem 0.9rem;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 6px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

/* Entrada de Búsqueda Mejorada */
.search-container { margin-bottom: 1.5rem; }

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 14px;
  color: #64748b;
  pointer-events: none;
}

.inp {
  width: 100%;
  background: var(--bg-card, #111422);
  border: 1px solid var(--border, rgba(255,255,255,0.06));
  border-radius: 8px;
  padding: 0.75rem 1rem;
  color: #ffffff;
  font-size: 0.92rem;
  transition: border-color 0.2s;
}

.search-inp {
  padding-left: 2.6rem;
}

.inp:focus { outline: none; border-color: var(--accent, #a3e635); }
.search-wrapper:focus-within .search-icon { color: var(--accent, #a3e635); }

/* Estados Vacíos y de Carga */
.state-msg { text-align: center; padding: 3rem 0; color: #64748b; font-size: 0.95rem; font-weight: 500;}
.text-pulse { animation: pulseOpacity 1.5s ease-in-out infinite; margin: 0; }
@keyframes pulseOpacity { 50% { opacity: 0.5; } }

.vacio { padding: 4rem 1.5rem; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.01); border: 1px dashed rgba(255,255,255,0.06); border-radius: 8px; }
.vacio-icono { color: rgba(255, 255, 255, 0.2); margin-bottom: 1rem; }
.v-title { font-weight: 600; font-size: 1.05rem; margin-bottom: 0.4rem; color: #ffffff; }
.dim { color: rgba(255, 255, 255, 0.5); font-size: 0.85rem; line-height: 1.4; margin: 0; max-width: 320px; }

/* Listado de Productos Estilo ERP */
.lista-productos { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.card { background: var(--bg-card, #111422); border: 1px solid var(--border, rgba(255,255,255,0.06)); border-radius: 8px; }

.item-prod {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  gap: 1rem;
  transition: transform 0.15s ease, background 0.2s, border-color 0.2s;
  outline: none;
  cursor: pointer;
}

.item-prod:hover, .item-prod:focus-visible {
  border-color: rgba(163, 230, 53, 0.2);
  background: linear-gradient(to right, #111422, var(--bg-hover, #15192b));
}

.item-prod:active { transform: scale(0.99); }

.p-info { flex: 1; min-width: 0; }
.p-nombre {
  font-weight: 600;
  font-size: 1rem;
  color: #ffffff;
  display: block;
  margin-bottom: 0.4rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-meta { display: flex; flex-wrap: wrap; gap: 0.5rem 0.8rem; align-items: center; }
.meta-tag { font-size: 0.8rem; color: #94a3b8; white-space: nowrap; }
.precio-tag { color: var(--accent, #a3e635); font-weight: 700; font-size: 0.9rem; letter-spacing: -0.01em; }
.costo-tag { border-left: 1px solid rgba(255,255,255,0.1); padding-left: 0.8rem; }
.stock-tag { background: rgba(255,255,255,0.04); padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); font-weight: 500; }
.low-stock { color: #f87171; background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.15); }

/* Control de Borrado */
.btn-del {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.2);
  cursor: pointer;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  transition: all 0.2s;
  flex-shrink: 0;
}
.btn-del:hover { color: #f87171; background: rgba(239, 68, 68, 0.08); }

/* Formulario e Inyecciones de Campos */
.field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.1rem; }
.field label { color: #cbd5e1; font-size: 0.82rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.field input {
  background: rgba(0,0,0,0.15);
  border: 1px solid var(--border, rgba(255,255,255,0.06));
  border-radius: 6px;
  padding: 0.75rem 0.9rem;
  color: #ffffff;
  font-size: 0.92rem;
}
.field input:focus { outline: none; border-color: var(--accent, #a3e635); }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.margen-hint { font-size: 0.82rem; margin: -0.5rem 0 1.1rem 0; font-weight: 600; }
.ok-text { color: var(--accent, #a3e635); }

.barcode-row { display: flex; gap: 0.5rem; }
.barcode-row input { flex: 1; }
.mini-scan { height: 42px; padding: 0 0.9rem; font-size: 0.82rem; font-weight: 600; white-space: nowrap; }

/* Forzado de Viewport Absoluto para la capa Modal */
.modal-bg { 
  position: fixed; 
  inset: 0 !important; 
  width: 100vw; 
  height: 100vh; 
  background: rgba(6, 8, 13, 0.85); 
  display: grid; 
  place-items: center; 
  padding: 1rem; 
  z-index: 99999 !important; /* Prioridad absoluta base del modal */
  backdrop-filter: blur(4px); 
  outline: none; 
}
.modal { width: 100%; max-width: 480px; padding: 1.8rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
.modal h3 { margin: 0 0 1.4rem 0; font-size: 1.25rem; color: #ffffff; font-weight: 700; letter-spacing: -0.01em; }
.modal-acciones { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.modal-acciones .btn { height: 42px; font-weight: 600; padding: 0 1.25rem; border-radius: 6px; }

/* Clase agregada para forzar el escáner sobre cualquier modal del DOM */
.escaner-supremo {
  position: fixed !important;
  inset: 0 !important;
  z-index: 1000000 !important; /* Estrictamente mayor que el z-index del modal */
}

/* Animaciones */
.page.fade-up {
  opacity: 0;
  transform: translateY(8px);
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.animate-fade-in { animation: fadeIn 0.3s ease forwards; }

@keyframes slideUp { to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

@media (max-width: 480px) {
  .page-head { flex-wrap: wrap; }
  .page-head h1 { order: -1; width: 100%; }
  .head-acciones { flex-wrap: wrap; width: 100%; }
  .head-acciones .mini-btn { flex: 1; justify-content: center; }

  .form-row { grid-template-columns: 1fr; }
  .barcode-row { flex-direction: column; }
  .mini-scan { width: 100%; height: 44px; justify-content: center; }

  .p-meta { gap: 0.4rem; }
}

@media (min-width: 560px) {
  .p-nombre { font-size: 1.05rem; }
  .item-prod { padding: 1.1rem 1.4rem; }
}
</style>