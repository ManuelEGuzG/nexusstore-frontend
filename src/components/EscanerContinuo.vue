<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

/**
 * Escáner en MODO CONTINUO con control de cantidad flotante.
 * La cámara queda abierta. Cada producto escaneado aparece en un panel
 * flotante abajo, con botones +/− para ajustar la cantidad sin cerrar la cámara.
 */

interface ItemEscaneado {
  product_id: number | null
  descripcion: string
  cantidad: number
}

const props = defineProps<{
  items: ItemEscaneado[] // el carrito actual, para mostrarlo en el panel
}>()

const emit = defineEmits<{
  leido: [codigo: string]
  cambiarCantidad: [productId: number, delta: number]
  cerrar: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const error = ref('')
const cargando = ref(true)

const DEBOUNCE = 1500
let ultimoCodigo = ''
let ultimoMomento = 0

let reader: BrowserMultiFormatReader | null = null
let controls: IScannerControls | null = null
let audioCtx: AudioContext | null = null

onMounted(async () => {
  try {
    reader = new BrowserMultiFormatReader()
    controls = await reader.decodeFromVideoDevice(
      undefined,
      videoRef.value!,
      (result) => {
        if (!result) return
        const codigo = result.getText()
        const ahora = Date.now()
        if (codigo === ultimoCodigo && ahora - ultimoMomento < DEBOUNCE) return
        ultimoCodigo = codigo
        ultimoMomento = ahora
        emit('leido', codigo)
      },
    )
    cargando.value = false
  } catch (e: any) {
    cargando.value = false
    if (e?.name === 'NotAllowedError') {
      error.value = 'Permiso de cámara denegado. Activalo en el navegador.'
    } else if (e?.name === 'NotFoundError') {
      error.value = 'No se encontró una cámara en este dispositivo.'
    } else if (location.protocol === 'http:' && !location.hostname.includes('localhost')) {
      error.value = 'La cámara necesita HTTPS. Por ahora podés escribir el código a mano.'
    } else {
      error.value = 'No se pudo abrir la cámara: ' + (e?.message || 'error')
    }
  }
})

function detener() {
  try { controls?.stop() } catch { /* ignore */ }
  controls = null
}
onBeforeUnmount(detener)

// Beep de confirmación (lo invoca el padre vía ref)
function beep(exito: boolean) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.frequency.value = exito ? 880 : 300
    gain.gain.value = 0.08
    osc.start()
    osc.stop(audioCtx.currentTime + (exito ? 0.08 : 0.18))
  } catch { /* sin audio, no pasa nada */ }
}

// Aviso breve (toast) + beep
interface Toast { id: number; texto: string; ok: boolean }
const toasts = ref<Toast[]>([])
let toastId = 0
function avisar(texto: string, ok = true) {
  const id = ++toastId
  toasts.value.push({ id, texto, ok })
  beep(ok)
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 1600)
}

defineExpose({ avisar })

function fmt(n: number) {
  return n
}

// Entrada manual de respaldo
const manual = ref('')
function enviarManual() {
  if (manual.value.trim()) {
    const cod = manual.value.trim()
    manual.value = ''
    emit('leido', cod)
  }
}
</script>

<template>
  <div class="esc-bg">
    <div class="esc-card card">
      <div class="esc-header">
        <h3>Escaneando ventas</h3>
        <button class="cerrar" @click="detener(); emit('cerrar')">Terminar</button>
      </div>

      <div v-if="!error" class="video-wrap">
        <video ref="videoRef" class="video" autoplay muted playsinline></video>
        <div class="marco"></div>
        <p v-if="cargando" class="cargando">Abriendo cámara…</p>
        <p v-else class="hint">Apuntá a cada producto</p>

        <div class="toasts">
          <div
            v-for="t in toasts"
            :key="t.id"
            class="toast"
            :class="t.ok ? 'ok' : 'no'"
          >
            {{ t.texto }}
          </div>
        </div>
      </div>

      <div v-else class="error-box">
        <p class="err-txt">{{ error }}</p>
      </div>

      <!-- Panel flotante de control de cantidades -->
      <div v-if="items.length" class="control-panel">
        <p class="cp-label">En la venta ({{ items.length }})</p>
        <ul class="cp-list">
          <li v-for="(it, i) in items" :key="i" class="cp-item">
            <span class="cp-nombre">{{ it.descripcion }}</span>
            <div class="cp-ctrl">
              <button
                class="cp-btn"
                @click="it.product_id !== null && emit('cambiarCantidad', it.product_id, -1)"
              >−</button>
              <span class="cp-cant">{{ it.cantidad }}</span>
              <button
                class="cp-btn"
                @click="it.product_id !== null && emit('cambiarCantidad', it.product_id, 1)"
              >+</button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Entrada manual -->
      <div class="manual">
        <div class="manual-row">
          <input
            v-model="manual"
            type="text"
            inputmode="numeric"
            placeholder="Código a mano…"
            @keyup.enter="enviarManual"
          />
          <button class="btn btn-ghost" @click="enviarManual">Sumar</button>
        </div>
      </div>

      <button class="btn btn-primary btn-block terminar" @click="detener(); emit('cerrar')">
        Terminar de escanear
      </button>
    </div>
  </div>
</template>

<style scoped>
.esc-bg {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8);
  display: grid; place-items: center; padding: 1rem; z-index: 70;
  backdrop-filter: blur(4px);
}
.esc-card { padding: 1.4rem; width: 100%; max-width: 420px; max-height: 92vh; overflow-y: auto; }
.esc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.esc-header h3 { font-size: 1.2rem; }
.cerrar {
  background: none; border: 1px solid var(--border); color: var(--text);
  font-size: 0.85rem; cursor: pointer; padding: 0.4rem 0.8rem; border-radius: 8px;
}
.video-wrap {
  position: relative; width: 100%; aspect-ratio: 4 / 3;
  background: #000; border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 1rem;
}
.video { width: 100%; height: 100%; object-fit: cover; }
.marco {
  position: absolute; inset: 18% 12%; border: 3px solid var(--accent);
  border-radius: 12px; box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.25);
}
.cargando, .hint {
  position: absolute; bottom: 10px; left: 0; right: 0; text-align: center;
  color: #fff; font-size: 0.85rem; text-shadow: 0 1px 4px rgba(0,0,0,0.8);
}
.toasts {
  position: absolute; top: 10px; left: 0; right: 0;
  display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
}
.toast {
  font-family: var(--font-display); font-weight: 700; font-size: 0.95rem;
  padding: 0.5rem 1rem; border-radius: 999px; animation: pop 0.2s ease;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.toast.ok { background: var(--accent); color: #11140a; }
.toast.no { background: var(--warn); color: #2a1d00; }
@keyframes pop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.error-box { padding: 1.5rem; background: var(--bg-elev); border-radius: var(--radius-sm); margin-bottom: 1rem; }
.err-txt { color: var(--warn); font-size: 0.92rem; line-height: 1.5; }

.control-panel {
  background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 0.8rem; margin-bottom: 1rem;
  max-height: 180px; overflow-y: auto;
}
.cp-label { color: var(--text-dim); font-size: 0.8rem; margin-bottom: 0.5rem; }
.cp-list { list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }
.cp-item { display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; }
.cp-nombre { font-size: 0.92rem; font-weight: 500; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-ctrl { display: flex; align-items: center; gap: 0.5rem; }
.cp-btn {
  width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg-card); color: var(--text); font-size: 1.3rem; cursor: pointer;
  display: grid; place-items: center;
}
.cp-btn:active { transform: scale(0.92); }
.cp-cant { min-width: 26px; text-align: center; font-weight: 700; font-family: var(--font-display); }

.manual { margin-bottom: 1rem; }
.manual-row { display: flex; gap: 0.6rem; }
.manual-row input {
  flex: 1; background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 0.7rem; color: var(--text); min-height: 48px;
}
.manual-row input:focus { outline: none; border-color: var(--accent); }
.terminar { min-height: 54px; font-size: 1.05rem; }
</style>