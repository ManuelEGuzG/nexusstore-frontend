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
  <div class="page fade-up">
    <header class="page-head">
      <button class="back" @click="router.push('/')">←</button>
      <h1>Productos</h1>
      <button class="btn btn-ghost mini" @click="escanearParaBuscar">Escanear</button>
      <button class="btn btn-primary mini" @click="nuevo">+ Producto</button>
    </header>

    <div class="search-container">
      <input v-model="busqueda" class="inp" placeholder="Buscar por nombre o código…" @input="cargar" />
    </div>

    <p v-if="cargando" class="dim state-msg">Cargando catálogo…</p>
    <p v-else-if="!productos.length" class="dim state-msg">No hay productos. Agregá el primero.</p>

    <ul v-else class="lista-productos">
      <li v-for="p in productos" :key="p.id" class="card item-prod">
        <div class="p-info" @click="editar(p)">
          <span class="p-nombre">{{ p.nombre }}</span>
          <div class="p-meta">
            <span class="meta-tag precio-tag">{{ fmt(p.precio) }}</span>
            <span v-if="p.costo" class="meta-tag costo-tag">costo {{ fmt(p.costo) }}</span>
            <span class="meta-tag stock-tag" :class="{ 'low-stock': p.stock_actual <= 0 }">
              stock: {{ p.stock_actual }}
            </span>
            <span v-if="p.barcode" class="meta-tag barcode-tag muted">{{ p.barcode }}</span>
          </div>
        </div>
        <button class="btn-del" @click.stop="eliminar(p)" title="Eliminar producto">×</button>
      </li>
    </ul>

    <div v-if="mostrarForm" class="modal-bg" @click.self="mostrarForm = false">
      <div class="modal">
        <h3>{{ editando ? 'Editar' : 'Nuevo' }} producto</h3>
        
        <div class="field">
          <label>Nombre del artículo</label>
          <input v-model="fNombre" placeholder="Ej. Agua Cristal 600ml" />
        </div>
        
        <div class="form-row">
          <div class="field">
            <label>Precio de venta</label>
            <input v-model="fPrecio" type="number" inputmode="decimal" placeholder="₡0" />
          </div>
          <div class="field">
            <label>Costo unitario</label>
            <input v-model="fCosto" type="number" inputmode="decimal" placeholder="Opcional" />
          </div>
        </div>
        
        <p v-if="margenForm()" class="margen-hint ok-text">{{ margenForm() }}</p>
        
        <div class="field">
          <label>Inventario inicial (Stock)</label>
          <input v-model="fStock" type="number" inputmode="decimal" placeholder="0" />
        </div>
        
        <div class="field">
          <label>Código de barras</label>
          <div class="barcode-row">
            <input v-model="fBarcode" placeholder="Escribí o usa el escaner" />
            <button class="btn btn-ghost mini-scan" @click="escanearParaCampo">Escanear</button>
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
/* Contenedor e Inputs */
.search-container {
  margin-bottom: var(--sp-4);
}

.state-msg {
  text-align: center;
  padding: var(--sp-5) 0;
  font-size: var(--fs-md);
}

/* Listado Adaptable de Productos */
.lista-productos {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.item-prod {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3);
  gap: var(--sp-3);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.item-prod:hover {
  border-color: var(--border-soft);
  background: linear-gradient(to right, var(--bg-card), var(--bg-hover));
}

.p-info {
  flex: 1;
  cursor: pointer;
  min-width: 0; /* Previene desbordamiento de textos larguísimos */
}

.p-nombre {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--fs-base);
  color: var(--text);
  display: block;
  margin-bottom: 0.35rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Flujo de Etiquetas Metadatos */
.p-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.6rem;
  align-items: center;
}

.meta-tag {
  font-size: var(--fs-xs);
  color: var(--text-dim);
  white-space: nowrap;
}

.precio-tag {
  color: var(--accent);
  font-weight: 600;
}

.stock-tag {
  background: var(--bg-elev);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.low-stock {
  color: var(--danger);
  background: var(--danger-soft);
}

/* Botón de Eliminación Táctil */
.btn-del {
  background: transparent;
  border: none;
  color: var(--text-faint);
  font-size: 1.6rem;
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-sm);
  transition: color 0.2s, background 0.2s;
  flex-shrink: 0;
}

.btn-del:hover {
  color: var(--danger);
  background: var(--danger-soft);
}

/* Filas internas del Formulario */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-3);
}

.margen-hint {
  font-size: var(--fs-xs);
  margin: calc(var(--sp-2) * -1) 0 var(--sp-3);
  font-weight: 500;
}

.barcode-row {
  display: flex;
  gap: var(--sp-2);
}

.barcode-row input {
  flex: 1;
}

.mini-scan {
  min-height: var(--touch);
  padding: 0 1rem;
}

/* Responsive Avanzado para pantallas más grandes */
@media (min-width: 560px) {
  .p-nombre {
    font-size: var(--fs-md);
  }
  
  .meta-tag {
    font-size: var(--fs-sm);
  }
  
  .item-prod {
    padding: var(--sp-3) var(--sp-4);
  }
}
</style>