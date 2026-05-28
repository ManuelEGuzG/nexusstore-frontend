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
  formaPago: string
  fecha?: string
}>()

const emit = defineEmits<{ cerrar: [] }>()

const auth = useAuthStore()

function fmt(n: number) {
  return '₡' + Number(n).toLocaleString('es-CR')
}

const fechaTexto = computed(() => {
  const d = props.fecha ? new Date(props.fecha) : new Date()
  return d.toLocaleString('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
})

const pagoTexto = computed(() => {
  const map: Record<string, string> = {
    efectivo: 'Efectivo',
    fiado: 'Fiado',
    manual: 'SINPE / Tarjeta',
  }
  return map[props.formaPago] || props.formaPago
})

// Compartir usando la API nativa del navegador (Web Share),
// con copia al portapapeles como respaldo. Funciona offline.
async function compartir() {
  const lineas = props.items
    .map((it) => `${it.cantidad}x ${it.descripcion}  ${fmt(it.cantidad * it.precio_unitario - it.descuento)}`)
    .join('\n')

  const texto =
    `*${auth.store?.nombre || 'Mi tienda'}*\n` +
    `${fechaTexto.value}\n` +
    `--------------------------\n` +
    `${lineas}\n` +
    `--------------------------\n` +
    `TOTAL: ${fmt(props.total)}\n` +
    `Pago: ${pagoTexto.value}\n` +
    `Comprobante: ${props.uuid.slice(0, 8)}`

  try {
    if (navigator.share) {
      await navigator.share({ title: 'Comprobante', text: texto })
    } else {
      await navigator.clipboard.writeText(texto)
      alert('Comprobante copiado. Pegalo en WhatsApp o donde quieras.')
    }
  } catch {
    // el usuario canceló el diálogo de compartir; no hacemos nada
  }
}
</script>

<template>
  <div class="tiquete-bg" @click.self="emit('cerrar')">
    <div class="tiquete card">
      <div class="check">✓</div>
      <h3>Venta registrada</h3>

      <div class="recibo">
        <div class="r-header">
          <strong>{{ auth.store?.nombre || 'Mi tienda' }}</strong>
          <span class="r-fecha">{{ fechaTexto }}</span>
        </div>

        <div class="r-divider"></div>

        <ul class="r-items">
          <li v-for="(it, i) in items" :key="i" class="r-item">
            <span class="ri-cant">{{ it.cantidad }}×</span>
            <span class="ri-desc">{{ it.descripcion }}</span>
            <span class="ri-monto">{{ fmt(it.cantidad * it.precio_unitario - it.descuento) }}</span>
          </li>
        </ul>

        <div class="r-divider"></div>

        <div class="r-total">
          <span>TOTAL</span>
          <span class="rt-num">{{ fmt(total) }}</span>
        </div>
        <div class="r-pago">
          <span>Pago</span>
          <span>{{ pagoTexto }}</span>
        </div>
        <div class="r-uuid">N° {{ uuid.slice(0, 8) }}</div>
      </div>

      <div class="acciones">
        <button class="btn btn-ghost" @click="compartir">Compartir</button>
        <button class="btn btn-primary" @click="emit('cerrar')">Nueva venta</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tiquete-bg {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
  display: grid; place-items: center; padding: 1rem; z-index: 60;
  backdrop-filter: blur(4px);
}
.tiquete { padding: 1.8rem; width: 100%; max-width: 360px; }
.check {
  width: 56px; height: 56px; border-radius: 50%; margin: 0 auto 0.8rem;
  background: var(--ok); color: #06281d; font-size: 2rem; font-weight: 700;
  display: grid; place-items: center;
}
.tiquete h3 { text-align: center; font-size: 1.3rem; margin-bottom: 1.3rem; }
.recibo {
  background: var(--bg-elev); border: 1px dashed var(--border);
  border-radius: var(--radius-sm); padding: 1.2rem;
  font-family: var(--font-body); margin-bottom: 1.3rem;
}
.r-header { display: flex; flex-direction: column; gap: 0.2rem; text-align: center; }
.r-header strong { font-family: var(--font-display); font-size: 1.05rem; }
.r-fecha { color: var(--text-dim); font-size: 0.8rem; }
.r-divider { border-top: 1px dashed var(--border); margin: 0.9rem 0; }
.r-items { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
.r-item { display: grid; grid-template-columns: auto 1fr auto; gap: 0.6rem; font-size: 0.9rem; }
.ri-cant { color: var(--text-dim); }
.ri-monto { font-weight: 600; }
.r-total {
  display: flex; justify-content: space-between; align-items: baseline;
  font-family: var(--font-display); font-weight: 800;
}
.rt-num { font-size: 1.4rem; color: var(--accent); }
.r-pago { display: flex; justify-content: space-between; color: var(--text-dim); font-size: 0.85rem; margin-top: 0.4rem; }
.r-uuid { text-align: center; color: var(--text-dim); font-size: 0.75rem; margin-top: 0.8rem; letter-spacing: 0.05em; }
.acciones { display: flex; gap: 0.7rem; }
.acciones .btn { flex: 1; }
</style>
