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
      error.value = 'La cámara necesita una conexión segura (HTTPS). Escribí el código a mano por ahora.'
    } else {
      error.value = 'No se pudo abrir la cámara: ' + (e?.message || 'error remoto')
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
  } catch { /* sin soporte de audio, falla silenciosa */ }
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
  <div class="modal-bg esc-bg">
    <div class="modal esc-card fade-up">
      <div class="esc-header">
        <h3>Escaneando ventas</h3>
        <button class="btn btn-ghost mini" @click="detener(); emit('cerrar')">Terminar</button>
      </div>

      <div v-if="!error" class="video-wrap">
        <video ref="videoRef" class="video" autoplay muted playsinline></video>
        <div class="marco"></div>
        <p v-if="cargando" class="cargando muted">Abriendo cámara…</p>
        <p v-else class="hint">Apuntá al código de barras del producto</p>

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
        <p class="err-txt warn-text">{{ error }}</p>
      </div>

      <div v-if="items.length" class="control-panel">
        <p class="cp-label">Artículos agregados ({{ items.length }})</p>
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

      <div class="manual">
        <div class="manual-row">
          <input
            v-model="manual"
            type="text"
            inputmode="numeric"
            class="inp"
            placeholder="O escribe el código a mano…"
            @keyup.enter="enviarManual"
          />
          <button class="btn btn-ghost" @click="enviarManual">Sumar</button>
        </div>
      </div>

      <button class="btn btn-primary btn-block terminar" @click="detener(); emit('cerrar')">
        Finalizar Venta
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Fondo oscuro con Blur heredado */
.esc-bg {
  background: rgba(6, 8, 12, 0.85);
  z-index: 70;
}

.esc-card {
  max-height: 92vh;
}

.esc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--sp-3);
}

.esc-header h3 {
  font-size: var(--fs-md);
}

/* Área del Stream de Video */
.video-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #000;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--sp-3);
  border: 1px solid var(--border);
}

.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Retícula o mira láser de escaneo */
.marco {
  position: absolute;
  inset: 22% 14%;
  border: 2px solid var(--accent);
  border-radius: var(--radius-sm);
  box-shadow: 0 0 0 100vmax rgba(14, 16, 20, 0.45);
  pointer-events: none;
}

.cargando, .hint {
  position: absolute;
  bottom: var(--sp-2);
  left: 0;
  right: 0;
  text-align: center;
  font-size: var(--fs-xs);
  font-weight: 500;
  padding: 0 var(--sp-2);
}

.hint {
  color: var(--text);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
}

/* Toasts Internos Animados */
.toasts {
  position: absolute;
  top: var(--sp-2);
  left: var(--sp-2);
  right: var(--sp-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-1);
  pointer-events: none;
}

.toast {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--fs-sm);
  padding: 0.4rem 1rem;
  border-radius: var(--radius-pill);
  animation: pop 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  box-shadow: var(--shadow);
}

.toast.ok { background: var(--accent); color: #11140a; }
.toast.no { background: var(--warn); color: #2a1d00; }

@keyframes pop {
  from { transform: scale(0.85); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* Caja de Error */
.error-box {
  padding: var(--sp-4);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  margin-bottom: var(--sp-3);
  text-align: center;
}

.err-txt {
  font-size: var(--fs-sm);
  line-height: 1.5;
}

/* Panel de Cantidades Ajustable */
.control-panel {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--sp-2) var(--sp-3);
  margin-bottom: var(--sp-3);
  max-height: 160px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.cp-label {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 600;
  margin-bottom: 0.4rem;
}

.cp-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}

.cp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  padding: 0.2rem 0;
}

.cp-nombre {
  font-size: var(--fs-sm);
  font-weight: 500;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-ctrl {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

/* Botón Táctil de Sumar/Restar */
.cp-btn {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
  font-size: 1.2rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.05s ease, background 0.2s;
}

.cp-btn:hover {
  background: var(--bg-hover);
  border-color: var(--text-faint);
}

.cp-btn:active {
  transform: scale(0.92);
}

.cp-cant {
  min-width: 24px;
  text-align: center;
  font-weight: 700;
  font-family: var(--font-display);
  font-size: var(--fs-base);
}

/* Formulario de Emergencia / Manual */
.manual {
  margin-bottom: var(--sp-3);
}

.manual-row {
  display: flex;
  gap: var(--sp-2);
}

.manual-row input {
  flex: 1;
}

.terminar {
  min-height: var(--touch);
}

/* Optimización Responsive: Adaptación Nativa en Celulares */
@media (max-width: 560px) {
  .esc-card {
    padding-bottom: 3.5rem; /* Resguardo táctil inferior para gestos del OS móvil */
  }
  
  .video-wrap {
    aspect-ratio: 16 / 11; /* Un poco más compacto en pantallas verticales */
  }
  
  .cp-btn {
    width: 44px; /* Meta táctil optimizada para dedos veloces */
    height: 44px;
  }
}
</style>