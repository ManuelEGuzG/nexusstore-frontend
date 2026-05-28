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

const mostrarForm = ref(false)
const editando = ref<Producto | null>(null)
const fNombre = ref('')
const fPrecio = ref('')
const fCosto = ref('')
const fStock = ref('')
const fBarcode = ref('')

const mostrarEscaner = ref(false)
const modoEscaner = ref<'campo' | 'buscar'>('campo')

function fmt(n: number) { return '₡' + Number(n).toLocaleString('es-CR') }

async function cargar() {
  cargando.value = true
  try {
    const { data } = await api.get('/products', { params: { q: busqueda.value } })
    productos.value = data
  } finally {
    cargando.value = false
  }
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
  // costo es opcional: solo lo mandamos si pusieron algo
  if (fCosto.value !== '') {
    payload.costo = parseFloat(fCosto.value)
  } else {
    payload.costo = null
  }

  if (editando.value) {
    await api.put(`/products/${editando.value.id}`, payload)
  } else {
    await api.post('/products', payload)
  }
  mostrarForm.value = false
  await cargar()
}

async function eliminar(p: Producto) {
  if (!confirm(`¿Eliminar "${p.nombre}"?`)) return
  await api.delete(`/products/${p.id}`)
  await cargar()
}

// Margen calculado en vivo en el formulario
function margenForm(): string {
  const precio = parseFloat(fPrecio.value)
  const costo = parseFloat(fCosto.value)
  if (!precio || !costo || costo <= 0) return ''
  const margen = ((precio - costo) / precio) * 100
  const ganancia = precio - costo
  return `Ganás ${fmt(ganancia)} por unidad (${margen.toFixed(0)}% de margen)`
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
        alert(`No hay ningún producto con el código ${codigo}.`)
      } else {
        alert('No se pudo buscar. ¿Hay conexión?')
      }
    }
  }
}
</script>

<template>
  <div class="wrap">
    <header class="top">
      <button class="btn btn-ghost mini" @click="router.push('/')">←</button>
      <h1>Productos</h1>
      <button class="btn btn-ghost mini" @click="escanearParaBuscar">Escanear</button>
      <button class="btn btn-primary mini" @click="nuevo">+ Producto</button>
    </header>

    <input v-model="busqueda" class="buscar" placeholder="Buscar…" @input="cargar" />

    <p v-if="cargando" class="dim">Cargando…</p>
    <p v-else-if="!productos.length" class="dim">No hay productos. Agregá el primero.</p>

    <ul v-else class="lista">
      <li v-for="p in productos" :key="p.id" class="prod">
        <div class="p-info" @click="editar(p)">
          <span class="p-nombre">{{ p.nombre }}</span>
          <span class="p-meta">
            {{ fmt(p.precio) }}<template v-if="p.costo"> · costo {{ fmt(p.costo) }}</template> · stock: {{ p.stock_actual }}<template v-if="p.barcode"> · {{ p.barcode }}</template>
          </span>
        </div>
        <button class="p-del" @click="eliminar(p)">×</button>
      </li>
    </ul>

    <!-- Formulario crear/editar -->
    <div v-if="mostrarForm" class="modal-bg" @click.self="mostrarForm = false">
      <div class="modal card">
        <h3>{{ editando ? 'Editar' : 'Nuevo' }} producto</h3>
        <div class="field"><label>Nombre</label><input v-model="fNombre" /></div>
        <div class="field">
          <label>Precio de venta</label>
          <input v-model="fPrecio" type="number" inputmode="decimal" />
        </div>
        <div class="field">
          <label>Costo (lo que te cuesta a vos) — opcional</label>
          <input v-model="fCosto" type="number" inputmode="decimal" placeholder="Para ver tu ganancia" />
        </div>
        <p v-if="margenForm()" class="margen-hint">{{ margenForm() }}</p>
        <div class="field"><label>Stock</label><input v-model="fStock" type="number" inputmode="decimal" /></div>
        <div class="field">
          <label>Código de barras</label>
          <div class="barcode-row">
            <input v-model="fBarcode" placeholder="Escaneá o escribí" />
            <button class="btn btn-ghost escan-btn" @click="escanearParaCampo">Escanear</button>
          </div>
        </div>
        <div class="modal-acciones">
          <button class="btn btn-ghost" @click="mostrarForm = false">Cancelar</button>
          <button class="btn btn-primary" @click="guardar">Guardar</button>
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
.wrap { max-width: 700px; margin: 0 auto; padding: 1rem 1.25rem 4rem; }
.top { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1.25rem; }
.top h1 { flex: 1; font-size: 1.5rem; }
.mini { min-height: 42px; padding: 0.5rem 0.9rem; }
.buscar { width: 100%; background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.85rem 1rem; color: var(--text); font-size: 1rem; margin-bottom: 1.25rem; min-height: 50px; }
.buscar:focus { outline: none; border-color: var(--accent); }
.dim { color: var(--text-dim); text-align: center; padding: 2rem 0; }
.lista { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
.prod { display: flex; align-items: center; padding: 0.9rem 1.2rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.p-info { flex: 1; cursor: pointer; }
.p-nombre { font-weight: 600; display: block; }
.p-meta { color: var(--text-dim); font-size: 0.85rem; }
.p-del { background: none; border: none; color: var(--danger); font-size: 1.4rem; cursor: pointer; padding: 0 0.5rem; }
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; padding: 1rem; z-index: 50; backdrop-filter: blur(4px); }
.modal { padding: 1.8rem; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto; }
.modal h3 { font-size: 1.3rem; margin-bottom: 1.2rem; }
.margen-hint { color: var(--ok); font-size: 0.85rem; margin: -0.5rem 0 1rem; }
.barcode-row { display: flex; gap: 0.5rem; }
.barcode-row input { flex: 1; }
.escan-btn { white-space: nowrap; }
.modal-acciones { display: flex; gap: 0.7rem; margin-top: 0.5rem; }
.modal-acciones .btn { flex: 1; }
</style>