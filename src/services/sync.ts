/**
 * Motor de sincronización. Toma las ventas pendientes de IndexedDB
 * y las envía al backend. Gracias a la idempotencia del servidor
 * (uuid_cliente único), reenviar una venta NUNCA la duplica.
 */

import api from '@/services/api'
import {
  listarPorEstado,
  actualizarVenta,
  type VentaLocal,
} from '@/services/offlineDb'

let sincronizando = false

/**
 * Intenta enviar todas las ventas pendientes.
 * Devuelve cuántas se sincronizaron con éxito.
 */
export async function sincronizarPendientes(): Promise<number> {
  if (sincronizando) return 0
  if (!navigator.onLine) return 0

  sincronizando = true
  let exitosas = 0

  try {
    const pendientes = await listarPorEstado('pendiente')

    for (const venta of pendientes) {
      try {
        await api.post('/sales', venta.payload)
        // El backend acepta (nueva) o reconoce (duplicada): ambos = OK.
        await actualizarVenta(venta.uuid_cliente, { estado: 'sincronizada' })
        exitosas++
      } catch (e: any) {
        // 422 = la venta ya existe o validación: la marcamos sincronizada
        // si fue duplicado, o error si fue otra cosa.
        const status = e.response?.status
        if (status === 200) {
          await actualizarVenta(venta.uuid_cliente, { estado: 'sincronizada' })
          exitosas++
        } else {
          await actualizarVenta(venta.uuid_cliente, {
            intentos: (venta.intentos ?? 0) + 1,
            error_msg: e.response?.data?.message || 'Error de red',
          })
        }
      }
    }
  } finally {
    sincronizando = false
  }

  return exitosas
}

/**
 * Arranca la sincronización automática:
 * - cuando vuelve la conexión (evento online)
 * - cada 30 segundos como respaldo
 */
export function iniciarAutoSync(onCambio?: () => void) {
  const correr = async () => {
    const n = await sincronizarPendientes()
    if (n > 0 && onCambio) onCambio()
  }

  window.addEventListener('online', correr)
  const intervalo = setInterval(correr, 30000)

  // Primer intento inmediato
  correr()

  // Devuelve función para detener
  return () => {
    window.removeEventListener('online', correr)
    clearInterval(intervalo)
  }
}
