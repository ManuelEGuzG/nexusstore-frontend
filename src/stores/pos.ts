import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { guardarVenta, contarPendientes } from '@/services/offlineDb'
import { sincronizarPendientes } from '@/services/sync'

export interface ItemCarrito {
  product_id: number | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
}

export type TipoPago = 'efectivo' | 'fiado' | 'manual'

export const usePosStore = defineStore('pos', () => {
  const items = ref<ItemCarrito[]>([])
  const pendientes = ref(0)
  const ultimaVenta = ref<any>(null)

  const total = computed(() =>
    items.value.reduce(
      (sum, it) => sum + (it.cantidad * it.precio_unitario - it.descuento),
      0,
    ),
  )

  const vacio = computed(() => items.value.length === 0)

  function agregarProducto(p: { id: number; nombre: string; precio: number }) {
    const existente = items.value.find((it) => it.product_id === p.id)
    if (existente) {
      existente.cantidad += 1
    } else {
      items.value.push({
        product_id: p.id,
        descripcion: p.nombre,
        cantidad: 1,
        precio_unitario: p.precio,
        descuento: 0,
      })
    }
  }

  function agregarMontoLibre(monto: number, descripcion = 'Venta varios') {
    items.value.push({
      product_id: null,
      descripcion,
      cantidad: 1,
      precio_unitario: monto,
      descuento: 0,
    })
  }

  function cambiarCantidad(index: number, cantidad: number) {
    if (cantidad <= 0) {
      items.value.splice(index, 1)
    } else {
      items.value[index].cantidad = cantidad
    }
  }

  function quitar(index: number) {
    items.value.splice(index, 1)
  }

  function limpiar() {
    items.value = []
  }

  /**
   * Finaliza la venta: la guarda local SIEMPRE (para no perderla aunque
   * no haya internet) y luego intenta sincronizar.
   * Guarda un snapshot en `ultimaVenta` para mostrar el comprobante.
   * Devuelve el uuid_cliente generado.
   */
  async function finalizar(opciones: {
    tipoPago: TipoPago
    customerId?: number | null
  }): Promise<string> {
    const uuid = crypto.randomUUID()
    const itemsSnapshot = items.value.map((it) => ({ ...it }))
    const totalSnapshot = total.value

    const payload = {
      uuid_cliente: uuid,
      estado: 'completada',
      customer_id: opciones.customerId ?? null,
      items: itemsSnapshot,
      payments: [{ tipo: opciones.tipoPago, monto: totalSnapshot }],
    }

    await guardarVenta({
      uuid_cliente: uuid,
      payload,
      estado: 'pendiente',
      creada_en: Date.now(),
      intentos: 0,
    })

    // Snapshot para el tiquete / comprobante en pantalla
    ultimaVenta.value = {
      uuid,
      items: itemsSnapshot,
      total: totalSnapshot,
      formaPago: opciones.tipoPago,
      fecha: new Date().toISOString(),
    }

    limpiar()

    // Intento de sincronización inmediato (si hay red)
    await sincronizarPendientes()
    await refrescarPendientes()

    return uuid
  }

  async function refrescarPendientes() {
    pendientes.value = await contarPendientes()
  }

  return {
    items,
    pendientes,
    ultimaVenta,
    total,
    vacio,
    agregarProducto,
    agregarMontoLibre,
    cambiarCantidad,
    quitar,
    limpiar,
    finalizar,
    refrescarPendientes,
  }
})