<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

const emit = defineEmits<{
  leido: [codigo: string]
  cerrar: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const error = ref('')
const cargando = ref(true)

// Debounce: igual que EscanerContinuo para evitar lecturas repetidas del mismo frame
const DEBOUNCE = 1200
let ultimoCodigo = ''
let ultimoMomento = 0
let yaEmitido = false

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
        if (!result || yaEmitido) return
        const codigo = result.getText()
        const ahora = Date.now()

        if (codigo === ultimoCodigo && ahora - ultimoMomento < DEBOUNCE) return
        ultimoCodigo = codigo
        ultimoMomento = ahora

        // Marca como emitido para que no dispare de nuevo mientras el modal aún está montado
        yaEmitido = true
        avisar(codigo, true)
        beep(true)

        // Pequeña pausa para que el toast sea visible antes de cerrar
        setTimeout(() => {
          detener()
          emit('leido', codigo)
        }, 400)
      },
    )
    cargando.value = false
  } catch (e: any) {
    cargando.value = false
    if (e?.name === 'NotAllowedError') {
      error.value = 'Permiso de cámara denegado. Actívalo en las preferencias del navegador.'
    } else if (e?.name === 'NotFoundError') {
      error.value = 'No se detectó ninguna cámara en este dispositivo.'
    } else if (location.protocol === 'http:' && !location.hostname.includes('localhost')) {
      error.value = 'El escáner requiere conexión HTTPS. Ingresá el código manualmente.'
    } else {
      error.value = 'Error al iniciar la cámara: ' + (e?.message || 'Error desconocido.')
    }
  }
})

function detener() {
  try { controls?.stop() } catch { /* ignore */ }
  controls = null
}

onBeforeUnmount(detener)

function beep(exito: boolean) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.frequency.value = exito ? 880 : 300
    gain.gain.value = 0.06
    osc.start()
    osc.stop(audioCtx.currentTime + (exito ? 0.08 : 0.18))
  } catch { /* falla silenciosa */ }
}

interface Toast { id: number; texto: string; ok: boolean }
const toasts = ref<Toast[]>([])
let toastId = 0

function avisar(texto: string, ok = true) {
  const id = ++toastId
  toasts.value.push({ id, texto, ok })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 1600)
}

const manual = ref('')
function enviarManual() {
  const cod = manual.value.trim()
  if (!cod || yaEmitido) return
  yaEmitido = true
  detener()
  emit('leido', cod)
}

function cerrar() {
  detener()
  emit('cerrar')
}
</script>

<template>
  <div class="esc-bg" @click.self="cerrar" @keydown.escape="cerrar" tabindex="-1">
    <div class="esc-card card fade-up" role="dialog" aria-modal="true" aria-labelledby="scanner-title">

      <div class="esc-header">
        <h3 id="scanner-title">Escanear Código de Barras</h3>
        <button type="button" class="btn-cerrar-top" @click="cerrar" aria-label="Cerrar escáner">×</button>
      </div>

      <div v-if="!error" class="video-wrap">
        <video ref="videoRef" class="video" autoplay muted playsinline></video>

        <div class="marco" :class="{ scanning: !cargando }">
          <div v-if="!cargando" class="linea-laser"></div>
        </div>

        <p v-if="cargando" class="status-text text-pulse">Iniciando cámara…</p>
        <p v-else class="status-text hint">Alineá el código en el recuadro</p>

        <div class="toasts" aria-live="polite">
          <div v-for="t in toasts" :key="t.id" class="toast" :class="t.ok ? 'ok' : 'no'">
            {{ t.texto }}
          </div>
        </div>
      </div>

      <div v-else class="error-box" role="alert">
        <p class="err-txt">{{ error }}</p>
      </div>

      <div class="manual">
        <div class="manual-row">
          <input
            v-model="manual"
            type="text"
            inputmode="numeric"
            class="inp"
            placeholder="O digitá el código manualmente…"
            autocomplete="off"
            @keyup.enter="enviarManual"
          />
          <button type="button" class="btn btn-primary" :disabled="!manual.trim()" @click="enviarManual">
            Confirmar
          </button>
        </div>
      </div>

      <button type="button" class="btn btn-ghost btn-block" @click="cerrar">
        Cancelar
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
  overflow-y: auto;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.card {
  background: var(--bg-card, #1d212a);
  border: 1px solid var(--border, #2b313d);
  border-radius: var(--radius-sm, 12px);
  display: flex !important;
}

.esc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.esc-header h3 {
  font-size: 1.1rem;
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
  transition: color 0.15s;
}
.btn-cerrar-top:hover { color: #ffffff; }

/* Área de video */
.video-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #06080d;
  border-radius: var(--radius-sm, 12px);
  overflow: hidden;
  margin-bottom: 1rem;
  border: 1px solid var(--border, #2b313d);
}

.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Marco de enfoque */
.marco {
  position: absolute;
  inset: 20% 12%;
  border: 2px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  box-shadow: 0 0 0 100vmax rgba(6, 8, 13, 0.65);
  pointer-events: none;
  transition: border-color 0.3s ease;
}
.marco.scanning { border-color: var(--accent, #b8ff3c); }

/* Línea láser */
.linea-laser {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent, #b8ff3c);
  box-shadow: 0 0 8px var(--accent, #b8ff3c);
  animation: laserSweep 2.2s linear infinite;
}
@keyframes laserSweep {
  0%   { top: 0%; }
  50%  { top: 100%; }
  100% { top: 0%; }
}

.status-text {
  position: absolute;
  bottom: 0.75rem;
  left: 1rem;
  right: 1rem;
  text-align: center;
  font-size: 0.8rem;
  font-weight: 500;
  margin: 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
}
.hint { color: #cbd5e1; }
.text-pulse { animation: pulseOpacity 1.5s ease-in-out infinite; color: #64748b; }
@keyframes pulseOpacity { 50% { opacity: 0.5; } }

/* Toasts HUD */
.toasts {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  pointer-events: none;
}
.toast {
  font-weight: 700;
  font-size: 0.88rem;
  padding: 0.45rem 1.1rem;
  border-radius: 50px;
  animation: pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
  max-width: 90%;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.toast.ok { background: var(--accent, #b8ff3c); color: #11140a; }
.toast.no { background: #f87171; color: #ffffff; }
@keyframes pop {
  from { transform: scale(0.85); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

/* Error */
.error-box {
  padding: 1.5rem;
  background: rgba(239, 68, 68, 0.06);
  border: 1px dashed rgba(239, 68, 68, 0.18);
  border-radius: var(--radius-sm, 12px);
  margin-bottom: 1rem;
  text-align: center;
}
.err-txt {
  color: #f87171;
  font-size: 0.88rem;
  line-height: 1.5;
  margin: 0;
  font-weight: 500;
}

/* Entrada manual */
.manual { margin-bottom: 0.75rem; }
.manual-row { display: flex; gap: 0.6rem; }
.manual-row .inp {
  flex: 1;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border, #2b313d);
  border-radius: var(--radius-sm, 12px);
  padding: 0.7rem 0.9rem;
  color: #ffffff;
  min-height: 44px;
  font-size: 0.92rem;
  transition: border-color 0.15s;
}
.manual-row .inp:focus {
  outline: none;
  border-color: var(--accent, #b8ff3c);
}

/* Botones */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.65rem 1.1rem;
  font-weight: 600;
  font-size: 0.88rem;
  border-radius: var(--radius-sm, 12px);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  min-height: 44px;
  white-space: nowrap;
}
.btn-primary {
  background: var(--accent, #b8ff3c);
  color: #11140a;
  border-color: transparent;
}
.btn-primary:hover:not(:disabled) { background: var(--accent-press, #a2e82f); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-ghost {
  background: transparent;
  color: #94a3b8;
  border-color: var(--border, #2b313d);
  width: 100%;
  margin-top: 0.25rem;
}
.btn-ghost:hover { background: rgba(255, 255, 255, 0.04); color: #ffffff; }

/* Animación de entrada */
.fade-up {
  opacity: 0;
  transform: translateY(8px);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slideUp { to { opacity: 1; transform: translateY(0); } }

@media (max-width: 560px) {
  .esc-card { padding: 1.25rem 1rem 2rem; }
  .video-wrap { aspect-ratio: 16 / 11; }
}
</style>
