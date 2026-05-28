/**
 * Capa de almacenamiento local para ventas offline (IndexedDB).
 * Cada venta se guarda aquí ANTES de intentar enviarla al servidor.
 * Así el POS sigue funcionando sin internet (sección 4.1 de la spec).
 *
 * No usamos librerías externas: IndexedDB nativo envuelto en promesas.
 */

const DB_NAME = 'nexusstore'
const DB_VERSION = 1
const STORE_VENTAS = 'ventas_pendientes'

export interface VentaLocal {
  uuid_cliente: string
  payload: Record<string, unknown>
  estado: 'pendiente' | 'sincronizada' | 'error'
  creada_en: number
  intentos: number
  error_msg?: string
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_VENTAS)) {
        const store = db.createObjectStore(STORE_VENTAS, { keyPath: 'uuid_cliente' })
        store.createIndex('estado', 'estado', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function guardarVenta(venta: VentaLocal): Promise<void> {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS, 'readwrite')
    tx.objectStore(STORE_VENTAS).put(venta)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function actualizarVenta(
  uuid: string,
  cambios: Partial<VentaLocal>,
): Promise<void> {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS, 'readwrite')
    const store = tx.objectStore(STORE_VENTAS)
    const getReq = store.get(uuid)
    getReq.onsuccess = () => {
      const actual = getReq.result as VentaLocal | undefined
      if (actual) {
        store.put({ ...actual, ...cambios })
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function listarPorEstado(
  estado: VentaLocal['estado'],
): Promise<VentaLocal[]> {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS, 'readonly')
    const idx = tx.objectStore(STORE_VENTAS).index('estado')
    const req = idx.getAll(estado)
    req.onsuccess = () => resolve(req.result as VentaLocal[])
    req.onerror = () => reject(req.error)
  })
}

export async function contarPendientes(): Promise<number> {
  const pendientes = await listarPorEstado('pendiente')
  return pendientes.length
}

export async function eliminarVenta(uuid: string): Promise<void> {
  const db = await abrir()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_VENTAS, 'readwrite')
    tx.objectStore(STORE_VENTAS).delete(uuid)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
