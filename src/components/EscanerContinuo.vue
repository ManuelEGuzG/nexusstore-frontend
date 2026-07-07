<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

/**
 * Escáner ULTRA-EFICIENTE con aceleración por Hardware (BarcodeDetector)
 * Calibrado con alertas visuales instantáneas y sonido amplificado.
 */

interface ItemEscaneado {
  product_id: number | null
  descripcion: string
  cantidad: number
}

const props = defineProps<{
  items: ItemEscaneado[]
}>()

const emit = defineEmits<{
  leido: [codigo: string]
  cambiarCantidad: [productId: number, delta: number]
  cerrar: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const error = ref('')
const cargando = ref(true)

// CONTROL DE DUPLICADOS: Bloquea el mismo código por 1.8 segundos para evitar ráfagas
const DEBOUNCE = 1800
let ultimoCodigo = ''
let ultimoMomento = 0

let reader: BrowserMultiFormatReader | null = null
let controls: IScannerControls | null = null
let audioCtx: AudioContext | null = null
let detectorLoopId: number | null = null

onMounted(async () => {
  try {
    cargando.value = true

    // Inicializar transmisión de la cámara
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })

    if (videoRef.value) {
      videoRef.value.srcObject = stream
    }

    // Autofoco Continuo nativo en el hardware móvil
    const track = stream.getVideoTracks()[0]
    if (track && typeof track.getCapabilities === 'function') {
      const capabilities = track.getCapabilities() as any
      if (capabilities?.focusMode?.includes('continuous')) {
        await track
          .applyConstraints({
            advanced: [{ focusMode: 'continuous' }],
          } as any)
          .catch(() => {})
      }
    }

    // DETECTOR POR HARDWARE (Aceleración por GPU nativa)
    if ('BarcodeDetector' in window) {
      const formatosSoportados = await (window as any).BarcodeDetector.getSupportedFormats()
      const formatosComerciales = ['ean_13', 'ean_8', 'upc_a'].filter((f) =>
        formatosSoportados.includes(f),
      )

      const detector = new (window as any).BarcodeDetector({ formats: formatosComerciales })

      const procesarCuadroNativo = async () => {
        if (!videoRef.value || videoRef.value.paused || videoRef.value.ended) {
          detectorLoopId = requestAnimationFrame(procesarCuadroNativo)
          return
        }
        try {
          const barcodes = await detector.detect(videoRef.value)
          if (barcodes.length > 0) {
            evaluarCodigo(barcodes[0].rawValue)
          }
        } catch {
          /* Ignorar fallos de cuadro */
        }
        detectorLoopId = requestAnimationFrame(procesarCuadroNativo)
      }

      detectorLoopId = requestAnimationFrame(procesarCuadroNativo)
    } else {
      // RESPALDO: Motor optimizado ZXing si el navegador no tiene soporte nativo
      const hints = new Map()
      hints.set(2, [0, 1, 4]) // EAN_13, EAN_8, UPC_A

      reader = new BrowserMultiFormatReader(hints)
      ;(reader as any).timeBetweenDecodingAttempts = 40

      controls = await reader.decodeFromVideoDevice(undefined, videoRef.value!, (result) => {
        if (result) evaluarCodigo(result.getText())
      })
    }

    cargando.value = false
  } catch (e: any) {
    cargando.value = false
    if (e?.name === 'NotAllowedError') {
      error.value = 'Permiso de cámara denegado. Actívalo en las preferencias del navegador.'
    } else if (e?.name === 'NotFoundError') {
      error.value = 'No se detectó hardware óptico en este dispositivo.'
    } else if (location.protocol === 'http:' && !location.hostname.includes('localhost')) {
      error.value = 'Seguridad de red: El terminal óptico requiere una transmisión cifrada HTTPS.'
    } else {
      error.value = 'Fallo del subsistema óptico: ' + (e?.message || 'Error desconocido.')
    }
  }
})

// Filtro inteligente de ráfagas repetidas con feedback en tiempo real
function evaluarCodigo(codigo: string) {
  const ahora = Date.now()

  // Si es el mismo código y está dentro del tiempo de gracia, se ignora por completo
  if (codigo === ultimoCodigo && ahora - ultimoMomento < DEBOUNCE) {
    return
  }

  ultimoCodigo = codigo
  ultimoMomento = ahora

  // ACCIÓN INMEDIATA: Desparar la notificación local en el HUD y el Beep amplificado al instante
  avisar(`Leído: ${codigo}`, true)

  // Comunicar al componente padre para que busque el producto e incremente el inventario
  emit('leido', codigo)
}

function detener() {
  if (detectorLoopId) cancelAnimationFrame(detectorLoopId)
  try {
    controls?.stop()
  } catch {}
  try {
    const stream = videoRef.value?.srcObject as MediaStream
    stream?.getTracks().forEach((t) => t.stop())
  } catch {}
  controls = null
}

onBeforeUnmount(detener)

// Generador de audio nativo con volumen incrementado
function beep(exito: boolean) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.frequency.value = exito ? 880 : 300
    // VOLUMEN SUBIDO: De 0.05 a 0.35 para una respuesta acústica clara en entornos ruidosos
    gain.gain.value = 0.35

    osc.start()
    osc.stop(audioCtx.currentTime + (exito ? 0.07 : 0.15))
  } catch {
    /* El navegador bloqueó el audio */
  }
}

interface Toast {
  id: number
  texto: string
  ok: boolean
}
const toasts = ref<Toast[]>([])
let toastId = 0

function avisar(texto: string, ok = true) {
  const id = ++toastId
  toasts.value.push({ id, texto, ok })
  beep(ok)

  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 1400)
}

defineExpose({ avisar })

const manual = ref('')
function enviarManual() {
  const codLimpio = manual.value.trim()
  if (codLimpio) {
    manual.value = ''
    // En manual también disparamos el aviso instantáneo
    avisar(`Código manual: ${codLimpio}`, true)
    emit('leido', codLimpio)
  }
}

function terminarFlujo() {
  detener()
  emit('cerrar')
}
</script>

<template>
  <div class="esc-bg" @click.self="terminarFlujo" @keydown.escape="terminarFlujo" tabindex="-1">
    <div
      class="esc-card card fade-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-continuous-title"
    >
      <div class="esc-header">
        <h3 id="modal-continuous-title">Escaneo Continuo de Ventas</h3>
        <button type="button" class="btn-cerrar-top" @click="terminarFlujo">×</button>
      </div>

      <div v-if="!error" class="video-wrap">
        <video ref="videoRef" class="video" autoplay muted playsinline></video>

        <div class="marco" :class="{ scanning: !cargando }">
          <div class="linea-laser" v-if="!cargando"></div>
        </div>

        <p v-if="cargando" class="status-text text-pulse">Inicializando canal de video…</p>
        <p v-else class="status-text hint">Alinee el código del artículo</p>

        <div class="toasts" aria-live="polite">
          <div v-for="t in toasts" :key="t.id" class="toast" :class="t.ok ? 'ok' : 'no'">
            {{ t.texto }}
          </div>
        </div>
      </div>

      <div v-else class="error-box" role="alert">
        <p class="err-txt">{{ error }}</p>
      </div>

      <div v-if="items.length" class="control-panel">
        <p class="cp-label">Líneas en transacción actual ({{ items.length }})</p>
        <ul class="cp-list">
          <li v-for="(it, i) in items" :key="i" class="cp-item">
            <span class="cp-nombre" :title="it.descripcion">{{ it.descripcion }}</span>
            <div class="cp-ctrl">
              <button
                type="button"
                class="cp-btn"
                aria-label="Restar unidad"
                @click="it.product_id !== null && emit('cambiarCantidad', it.product_id, -1)"
              >
                −
              </button>
              <span class="cp-cant">{{ it.cantidad }}</span>
              <button
                type="button"
                class="cp-btn"
                aria-label="Sumar unidad"
                @click="it.product_id !== null && emit('cambiarCantidad', it.product_id, 1)"
              >
                +
              </button>
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
            placeholder="O digite el código de barras…"
            autocomplete="off"
            @keyup.enter="enviarManual"
          />
          <button
            type="button"
            class="btn btn-ghost"
            :disabled="!manual.trim()"
            @click="enviarManual"
          >
            Agregar
          </button>
        </div>
      </div>

      <button type="button" class="btn btn-primary btn-block terminar" @click="terminarFlujo">
        Finalizar Venta
      </button>
    </div>
  </div>
</template>

<style scoped>
.esc-bg {
  position: fixed;
  inset: 0;
  background: rgba(6, 8, 13, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 150;
  backdrop-filter: blur(5px);
  outline: none;
}

.esc-card {
  padding: 1.6rem;
  width: 100%;
  max-width: 440px;
  min-width: 320px;
  max-height: 94vh;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.card {
  background: var(--bg-card, #111422);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  border-radius: 8px;
  display: block !important;
}

.esc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--sp-3, 1rem);
}

.esc-header h3 {
  font-size: var(--fs-md, 1.15rem);
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.01em;
}

.btn-cerrar-top {
  background: none;
  border: none;
  color: #64748b;
  font-size: 1.6rem;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  transition: color 0.15s ease;
}

.btn-cerrar-top:hover {
  color: #ffffff;
}

.video-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3 !important;
  background: #06080d;
  border-radius: var(--radius-sm, 6px);
  overflow: hidden;
  margin-bottom: var(--sp-3, 1rem);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
}

.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.marco {
  position: absolute;
  inset: 20% 12%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-sm, 6px);
  box-shadow: 0 0 0 100vmax rgba(6, 8, 13, 0.65);
  pointer-events: none;
  transition: border-color 0.3s ease;
}

.marco.scanning {
  border-color: var(--accent, #a3e635);
}

.linea-laser {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent, #a3e635);
  box-shadow: 0 0 8px var(--accent, #a3e635);
  animation: laserSweep 2.2s linear infinite;
}

@keyframes laserSweep {
  0% {
    top: 0%;
  }
  50% {
    top: 100%;
  }
  100% {
    top: 0%;
  }
}

.status-text {
  position: absolute;
  bottom: var(--sp-2, 0.75rem);
  left: 1rem;
  right: 1rem;
  text-align: center;
  font-size: var(--fs-xs, 0.8rem);
  font-weight: 500;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
}

.hint {
  color: #cbd5e1;
}
.text-pulse {
  animation: pulseOpacity 1.5s ease-in-out infinite;
  color: #64748b;
}

@keyframes pulseOpacity {
  50% {
    opacity: 0.5;
  }
}

.toasts {
  position: absolute;
  top: var(--sp-2, 0.75rem);
  left: var(--sp-2, 0.75rem);
  right: var(--sp-2, 0.75rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-1, 0.4rem);
  pointer-events: none;
}

.toast {
  font-family: var(--font-display, sans-serif);
  font-weight: 700;
  font-size: var(--fs-sm, 0.88rem);
  padding: 0.45rem 1.1rem;
  border-radius: 50px;
  animation: pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
}

.toast.ok {
  background: var(--accent, #a3e635);
  color: #111422;
}
.toast.no {
  background: var(--warn, #f87171);
  color: #ffffff;
}

@keyframes pop {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.error-box {
  padding: var(--sp-4, 1.5rem);
  background: rgba(239, 68, 68, 0.06);
  border: 1px dashed rgba(239, 68, 68, 0.18);
  border-radius: var(--radius-sm, 6px);
  margin-bottom: var(--sp-3, 1rem);
  text-align: center;
}

.err-txt {
  color: #f87171;
  font-size: var(--fs-sm, 0.88rem);
  line-height: 1.5;
  margin: 0;
  font-weight: 500;
}

.control-panel {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  border-radius: var(--radius-sm, 6px);
  padding: 0.75rem 0.9rem;
  margin-bottom: var(--sp-3, 1rem);
  max-height: 150px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.control-panel::-webkit-scrollbar {
  width: 5px;
}
.control-panel::-webkit-scrollbar-track {
  background: transparent;
}
.control-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.cp-label {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cp-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.cp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2, 0.75rem);
  padding: 0.15rem 0;
}

.cp-nombre {
  font-size: var(--fs-sm, 0.88rem);
  font-weight: 500;
  color: #e2e8f0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-ctrl {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cp-btn {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-sm, 6px);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  background: var(--bg-card, #111422);
  color: #ffffff;
  font-size: 1.2rem;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition:
    transform 0.05s ease,
    background-color 0.15s,
    border-color 0.15s;
}

.cp-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.15);
}
.cp-btn:active {
  transform: scale(0.92);
}

.cp-cant {
  min-width: 28px;
  text-align: center;
  font-weight: 700;
  color: #ffffff;
  font-family: var(--font-display, sans-serif);
  font-size: var(--fs-base, 1rem);
  font-variant-numeric: tabular-nums;
}

.manual {
  margin-bottom: var(--sp-3, 1rem);
}
.manual-row {
  display: flex;
  gap: var(--sp-2, 0.75rem);
}

.manual-row .inp {
  flex: 1;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  border-radius: 6px;
  padding: 0.7rem 0.9rem;
  color: #ffffff;
  min-height: 44px;
  font-size: 0.92rem;
  transition: border-color 0.15s ease;
}

.manual-row .inp:focus {
  outline: none;
  border-color: var(--accent, #a3e635);
}

.manual-row .btn {
  height: 44px;
  padding: 0 1.2rem;
  font-weight: 600;
  font-size: 0.88rem;
  border-radius: 6px;
  cursor: pointer;
}

.manual-row .btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.terminar {
  min-height: 46px;
  font-weight: 700;
  font-size: 0.95rem;
  border-radius: 6px;
  cursor: pointer;
}

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

@media (max-width: 560px) {
  .esc-card {
    padding-bottom: 2rem;
  }
  .video-wrap {
    aspect-ratio: 16 / 11 !important;
  }
}
</style>
