<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

interface ItemTiquete {
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento: number
}

const props = defineProps<{
  uuid: string
  items: ItemTiquete[]
  total: number
  formaPago: 'efectivo' | 'fiado' | 'manual' | string
  fecha?: string
}>()

const emit = defineEmits<{ cerrar: [] }>()

const auth = useAuthStore()

// Diccionario estático inmutable para evitar re-evaluaciones en el computed
const GLOSARIO_MEDIOS: Record<string, string> = {
  efectivo: 'Efectivo',
  fiado: 'Crédito Comercial',
  manual: 'Transacción Electrónica (SINPE / Tarjeta)',
}

/**
 * Formatea valores numéricos a la divisa oficial (Colón Costarricense).
 */
function fmt(n: number): string {
  return '₡' + Number(n).toLocaleString('es-CR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  })
}

const fechaTexto = computed(() => {
  const d = props.fecha ? new Date(props.fecha) : new Date()
  return d.toLocaleString('es-CR', {
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit',
  })
})

const pagoTexto = computed(() => GLOSARIO_MEDIOS[props.formaPago] || props.formaPago)

/**
 * Serializa los datos fiscales actuales y despacha el comprobante digital 
 * mediante la Web Share API, utilizando el portapapeles como respaldo nativo seguro.
 */
async function compartir() {
  const lineasArticulos = props.items
    .map((it) => {
      const subtotalNeto = (it.cantidad * it.precio_unitario) - it.descuento
      return `• ${it.cantidad} u. × ${it.descripcion} — ${fmt(subtotalNeto)}`
    })
    .join('\n')

  const plantillaTexto =
    `*${auth.store?.nombre || 'Comprobante Digital'}*\n` +
    `Fecha de Emisión: ${fechaTexto.value}\n` +
    `=============================\n` +
    `${lineasArticulos}\n` +
    `=============================\n` +
    `*TOTAL CONSOLIDADO:* ${fmt(props.total)}\n` +
    `Medio de Pago: ${pagoTexto.value}\n` +
    `ID Transacción: ${props.uuid.toUpperCase()}`

  try {
    if (navigator.share && navigator.canShare?.({ text: plantillaTexto })) {
      await navigator.share({ 
        title: `Comprobante Fiscal - ${props.uuid.slice(0, 8).toUpperCase()}`, 
        text: plantillaTexto 
      })
    } else {
      await navigator.clipboard.writeText(plantillaTexto)
      alert('Respaldo copiado al portapapeles del sistema de forma exitosa.')
    }
  } catch (error: any) {
    // Aislar cancelaciones nativas del usuario de fallos reales de la API
    if (error.name !== 'AbortError') {
      console.error('Fallo en la interfaz de compartición:', error)
    }
  }
}
</script>

<template>
  <div 
    class="tiquete-bg" 
    @click.self="emit('cerrar')"
    @keydown.escape="emit('cerrar')"
    tabindex="-1"
  >
    <div 
      class="tiquete card fade-up" 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <!-- Indicador Criptográfico Exitoso -->
      <div class="check" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <h3 id="modal-title">Operación Procesada</h3>

      <!-- Estructura del Ledger de Auditoría Estilo Ticket Térmico -->
      <div class="recibo">
        <div class="r-header">
          <strong>{{ auth.store?.nombre || 'Unidad de Negocio' }}</strong>
          <span class="r-fecha" :datetime="props.fecha">{{ fechaTexto }}</span>
        </div>

        <div class="r-divider" aria-hidden="true"></div>

        <!-- Desglose de Líneas de Facturación -->
        <ul class="r-items" aria-label="Desglose de artículos">
          <li v-for="(it, i) in items" :key="i" class="r-item">
            <span class="ri-cant">{{ it.cantidad }} u.</span>
            <span class="ri-desc" :title="it.descripcion">{{ it.descripcion }}</span>
            <span class="ri-monto">{{ fmt((it.cantidad * it.precio_unitario) - it.descuento) }}</span>
          </li>
        </ul>

        <div class="r-divider" aria-hidden="true"></div>

        <!-- Cierre de Caja Localizado -->
        <div class="r-total">
          <span>Total Liquidado</span>
          <span class="rt-num">{{ fmt(total) }}</span>
        </div>
        
        <div class="r-pago">
          <span>Estructura de Pago</span>
          <span class="rp-texto">{{ pagoTexto }}</span>
        </div>
        
        <div class="r-uuid" :title="`UUID Único de Auditoría: ${uuid}`">
          Firma: {{ uuid.toUpperCase() }}
        </div>
      </div>

      <!-- Controladores del Flujo de Interfaz -->
      <div class="acciones">
        <button type="button" class="btn btn-ghost" @click="compartir">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          Compartir
        </button>
        <button type="button" class="btn btn-primary" @click="emit('cerrar')">
          Siguiente Operación
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Capa de Bloqueo del viewport con difuminado gaussiano */
.tiquete-bg {
  position: fixed; 
  inset: 0; 
  background: rgba(6, 8, 13, 0.88);
  display: grid; 
  place-items: center; 
  padding: 1rem; 
  z-index: 100;
  backdrop-filter: blur(5px);
  outline: none;
}

.tiquete { 
  padding: 1.6rem; 
  width: 100%; 
  max-width: 380px; 
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6); 
}

.card { 
  background: var(--bg-card, #111422); 
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06)); 
  border-radius: 8px; 
}

/* Indicador de Transacción Exitosa */
.check {
  width: 52px; 
  height: 52px; 
  border-radius: 50%; 
  margin: 0 auto 1rem;
  background: rgba(34, 197, 94, 0.08); 
  color: var(--accent, #a3e635); 
  display: grid; 
  place-items: center;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.tiquete h3 { 
  text-align: center; 
  font-size: 1.2rem; 
  margin: 0 0 1.4rem 0; 
  font-weight: 700;
  color: #ffffff;
  letter-spacing: -0.02em;
}

/* Ledger de Auditoría (Formato de impresión térmica) */
.recibo {
  background: rgba(0, 0, 0, 0.22); 
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 6px; 
  padding: 1.25rem;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
  margin-bottom: 1.4rem;
}

.r-header { 
  display: flex; 
  flex-direction: column; 
  gap: 0.25rem; 
  text-align: center; 
}

.r-header strong { 
  font-size: 1.05rem; 
  color: #ffffff; 
  font-weight: 700; 
  letter-spacing: -0.01em; 
}

.r-fecha { 
  color: #64748b; 
  font-size: 0.78rem; 
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; 
}

.r-divider { 
  border-top: 1px dashed rgba(255, 255, 255, 0.1); 
  margin: 1.1rem 0; 
}

/* Filas de Artículos */
.r-items { 
  list-style: none; 
  padding: 0; 
  margin: 0; 
  display: flex; 
  flex-direction: column; 
  gap: 0.6rem; 
}

.r-item { 
  display: grid; 
  grid-template-columns: auto 1fr auto; 
  gap: 0.85rem; 
  font-size: 0.88rem; 
  align-items: baseline; 
}

.ri-cant { 
  color: #64748b; 
  font-weight: 500; 
  font-variant-numeric: tabular-nums; 
}

.ri-desc { 
  color: #e2e8f0; 
  text-overflow: ellipsis; 
  overflow: hidden; 
  white-space: nowrap; 
}

.ri-monto { 
  font-weight: 600; 
  color: #ffffff; 
  text-align: right; 
  font-variant-numeric: tabular-nums; 
}

/* Bloque de Liquidación y Totales */
.r-total {
  display: flex; 
  justify-content: space-between; 
  align-items: baseline;
  font-weight: 700;
  color: #cbd5e1;
}

.rt-num { 
  font-size: 1.4rem; 
  font-weight: 800; 
  color: var(--accent, #a3e635); 
  letter-spacing: -0.02em; 
  font-variant-numeric: tabular-nums; 
}

.r-pago { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  color: #64748b; 
  font-size: 0.8rem; 
  margin-top: 0.6rem; 
}

.rp-texto { 
  color: #94a3b8; 
  font-weight: 500; 
}

.r-uuid { 
  text-align: center; 
  color: #475569; 
  font-size: 0.68rem; 
  margin-top: 1.1rem; 
  letter-spacing: 0.03em; 
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

/* Botones de Acción Operativa */
.acciones { 
  display: flex; 
  gap: 0.75rem; 
}

.acciones .btn { 
  flex: 1; 
  height: 42px; 
  font-weight: 600; 
  font-size: 0.9rem; 
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  cursor: pointer;
  border-radius: 6px;
  transition: filter 0.2s ease, background-color 0.2s ease;
}

.acciones .btn:hover {
  filter: brightness(1.1);
}

/* Animaciones de Entrada Modales */
.fade-up {
  opacity: 0;
  transform: translateY(8px);
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp { 
  to { 
    opacity: 1; 
    transform: translateY(0); 
  } 
}
</style>