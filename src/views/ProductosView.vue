<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
    const { data } = await api.get('/products', { params: { q: busqueda.value } })
    productos.value = data
  } catch {
    /* Manejo preventivo de excepciones de red */ 
  } finally {
    cargando.value = false
  }
}

// Mitigación de ráfagas de peticiones al servidor (Debounce)
function handleBusqueda() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    cargar()
  }, 250)
}

onMounted(cargar)

function nuevo() {
  editando.value = null
  fNombre.value = ''; fPrecio.value = ''; fCosto.value = ''; fStock.value = ''; fBarcode.value = ''
  mostrarForm.value = true
}

function editar(p: Producto) {
  editando.value = p
  fNombre.value = p.nombre
  fPrecio.value = String(p.precio)
  fCosto.value = p.costo != null ? String(p.costo) : ''
  fStock.value = String(p.stock_actual)
  fBarcode.value = p.barcode || ''
  mostrarForm.value = true
}

async function guardar() {
  const payload: any = {
    nombre: fNombre.value,
    precio: parseFloat(fPrecio.value) || 0,
    stock_actual: parseFloat(fStock.value) || 0,
    barcode: fBarcode.value || null,
  }
  payload.costo = fCosto.value !== '' ? parseFloat(fCosto.value) : null

  try {
    if (editando.value) {
      await api.put(`/products/${editando.value.id}`, payload)
    } else {
      await api.post('/products', payload)
    }
    mostrarForm.value = false
    await cargar()
  } catch {
    alert('Error al intentar procesar el registro del artículo.')
  }
}

async function eliminar(p: Producto) {
  if (!confirm(`¿Confirmar la baja definitiva del producto: "${p.nombre}"?`)) return
  try {
    await api.delete(`/products/${p.id}`)
    await cargar()
  } catch {
    alert('No fue posible eliminar el registro. Verifique dependencias en transacciones existentes.')
  }
}

function margenForm(): string {
  const precio = parseFloat(fPrecio.value)
  const costo = parseFloat(fCosto.value)
  if (!precio || !costo || costo <= 0 || precio <= costo) return ''
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
      if (data.encontrado) {
        editar(data.producto)
      }
    } catch (e: any) {
      if (e.response?.status === 404) {
        alert(`No se encontró ningún artículo indexado con el código: ${codigo}`)
      } else {
        alert('Error de conectividad en la verificación remota del código.')
      }
    }
  }
}
</script>

<template>
  <div class="page fade-up">
    <header class="page-head">
      <button class="back" @click="router.push('/')" aria-label="Regresar al menú principal">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      </button>
      <h1>Catálogo de Productos</h1>
      <div class="head-acciones">
        <button class="btn btn-ghost mini-btn" @click="escanearParaBuscar">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6m6-6l-7.5 7.5M3 22v-6h6m-6 6l7.5-7.5"></path></svg>
          Escanear
        </button>
        <button class="btn btn-primary mini-btn" @click="nuevo">
          + Agregar Artículo
        </button>
      </div>
    </header>

    <div class="search-container">
      <input 
        v-model="busqueda" 
        class="inp" 
        placeholder="Filtrar por descripción, código de barras o SKU…" 
        @input="handleBusqueda" 
      />
    </div>

    <p v-if="cargando" class="dim state-msg">Sincronizando maestro de inventario…</p>
    <p v-else-if="!productos.length" class="dim state-msg">Ningún artículo coincide con los criterios de búsqueda.</p>

    <ul v-else class="lista-productos">
      <li v-for="p in productos" :key="p.id" class="card item-prod">
        <div class="p-info" @click="editar(p)">
          <span class="p-nombre">{{ p.nombre }}</span>
          <div class="p-meta">
            <span class="meta-tag precio-tag">{{ fmt(p.precio) }}</span>
            <span v-if="p.costo" class="meta-tag costo-tag">Costo: {{ fmt(p.costo) }}</span>
            <span class="meta-tag stock-tag" :class="{ 'low-stock': p.stock_actual <= 0 }">
              Existencia: {{ p.stock_actual }} u.
            </span>
            <span v-if="p.barcode" class="meta-tag barcode-tag muted">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:2px; vertical-align:middle;"><line x1="3" y1="5" x2="3" y2="19"></line><line x1="6" y1="5" x2="6" y2="19"></line><line x1="10" y1="5" x2="10" y2="19"></line><line x1="14" y1="5" x2="14" y2="19"></line><line x1="17" y1="5" x2="17" y2="19"></line><line x1="21" y1="5" x2="21" y2="19"></line></svg>
              {{ p.barcode }}
            </span>
          </div>
        </div>
        <button class="btn-del" @click.stop="eliminar(p)" title="Eliminar del catálogo">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </li>
    </ul>

    <div v-if="mostrarForm" class="modal-bg" @click.self="mostrarForm = false">
      <div class="modal card">
        <h3>{{ editando ? 'Modificar Registro de' : 'Registrar Nuevo' }} Producto</h3>
        
        <div class="field">
          <label for="f-nombre">Descripción del Artículo</label>
          <input id="f-nombre" v-model="fNombre" placeholder="Ej. Líquido Purificado 600ml" required />
        </div>
        
        <div class="form-row">
          <div class="field">
            <label for="f-precio">Precio de Venta</label>
            <input id="f-precio" v-model="fPrecio" type="number" inputmode="decimal" placeholder="₡0" required />
          </div>
          <div class="field">
            <label for="f-costo">Costo Unitario Base</label>
            <input id="f-costo" v-model="fCosto" type="number" inputmode="decimal" placeholder="Opcional" />
          </div>
        </div>
        
        <p v-if="margenForm()" class="margen-hint ok-text" role="status">{{ margenForm() }}</p>
        
        <div class="field">
          <label for="f-stock">Inventario Inicial (Existencia)</label>
          <input id="f-stock" v-model="fStock" type="number" inputmode="decimal" placeholder="0" required />
        </div>
        
        <div class="field">
          <label for="f-barcode">Código de Barras Universal (EAN/UPC)</label>
          <div class="barcode-row">
            <input id="f-barcode" v-model="fBarcode" placeholder="Ingrese o escanee el identificador" />
            <button class="btn btn-ghost mini-scan" @click="escanearParaCampo">
              Escanear
            </button>
          </div>
        </div>
        
        <div class="modal-acciones">
          <button class="btn btn-ghost" @click="mostrarForm = false">Cancelar</button>
          <button class="btn btn-primary" @click="guardar">Confirmar Guardado</button>
        </div>
      </div>
    </div>

    <EscanerCodigo
      v-if="mostrarEscaner"
      @leido="onCodigoLeido"
      @cerrar="mostrarEscaner = false"
    />
  </div>
</template>

<style scoped>
.page {
  padding: clamp(1rem, 3vw, 2rem);
  max-width: 900px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
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

/* Entrada de Búsqueda */
.search-container { margin-bottom: 1.5rem; }
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
.inp:focus { outline: none; border-color: var(--accent, #a3e635); }

.state-msg { text-align: center; padding: 2rem 0; color: var(--text-dim, #64748b); font-size: 0.9rem; }

/* Listado de Productos Estilo ERP */
.lista-productos { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.card { background: var(--bg-card, #111422); border: 1px solid var(--border, rgba(255,255,255,0.06)); border-radius: 8px; }

.item-prod {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.9rem 1.1rem;
  gap: 1rem;
  transition: background 0.2s, border-color 0.2s;
}
.item-prod:hover {
  border-color: rgba(163, 230, 53, 0.2);
  background: linear-gradient(to right, #111422, var(--bg-hover, #15192b));
}

.p-info { flex: 1; cursor: pointer; min-width: 0; }
.p-nombre {
  font-weight: 600;
  font-size: 1rem;
  color: #ffffff;
  display: block;
  margin-bottom: 0.3rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.p-meta { display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; align-items: center; }
.meta-tag { font-size: 0.8rem; color: var(--text-dim, #64748b); white-space: nowrap; }
.precio-tag { color: var(--accent, #a3e635); font-weight: 700; }
.costo-tag { border-left: 1px solid rgba(255,255,255,0.1); padding-left: 0.8rem; }
.stock-tag { background: rgba(255,255,255,0.03); padding: 0.1rem 0.4rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.04); }
.low-stock { color: #f87171; background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.15); }

/* Control de Borrado */
.btn-del {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.2);
  cursor: pointer;
  width: 36px;
  height: 36px;
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
  padding: 0.7rem 0.9rem;
  color: #ffffff;
  font-size: 0.92rem;
}
.field input:focus { outline: none; border-color: var(--accent, #a3e635); }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.margen-hint { font-size: 0.82rem; margin: -0.5rem 0 1.1rem 0; font-weight: 600; }
.ok-text { color: var(--accent, #a3e635); }

.barcode-row { display: flex; gap: 0.5rem; }
.barcode-row input { flex: 1; }
.mini-scan { height: 40px; padding: 0 0.9rem; font-size: 0.82rem; font-weight: 600; white-space: nowrap; }

/* Arquitectura Modal Integrada para el Formulario */
.modal-bg { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(6, 8, 13, 0.85); display: grid; place-items: center; padding: 1rem; z-index: 100; backdrop-filter: blur(4px); }
.modal { width: 100%; max-width: 480px; padding: 1.8rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); }
.modal h3 { margin: 0 0 1.4rem 0; font-size: 1.2rem; color: #ffffff; font-weight: 700; letter-spacing: -0.01em; }
.modal-acciones { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }

/* Animaciones */
.fade-up {
  opacity: 0;
  transform: translateY(6px);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slideUp { to { opacity: 1; transform: translateY(0); } }

@media (min-width: 560px) {
  .p-nombre { font-size: 1.05rem; }
  .item-prod { padding: 1rem 1.4rem; }
}
</style>