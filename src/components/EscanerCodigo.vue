<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

const emit = defineEmits<{
  leido: [codigo: string]
  cerrar: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const errorInstancia = ref('')
const cargandoHardware = ref(true)
const codigoManual = ref('')

let lectorZXing: BrowserMultiFormatReader | null = null
let controladoresStream: IScannerControls | null = null

/**
 * Libera de forma segura los recursos del hardware de captura y detiene los hilos de video.
 */
function detenerCaptura() {
  if (controladoresStream) {
    try {
      controladoresStream.stop()
    } catch (e) {
      console.warn('Aviso preventivo en cierre de canal óptico:', e)
    }
    controladoresStream = null
  }
}

onMounted(async () => {
  // La API de MediaDevices requiere contextos seguros (HTTPS o localhost).
  try {
    lectorZXing = new BrowserMultiFormatReader()

    // Configuración por defecto: Prioriza periféricos de captura traseros en terminales móviles.
    controladoresStream = await lectorZXing.decodeFromVideoDevice(
      undefined,
      videoRef.value!,
      (resultado, excepcionFrame) => {
        if (resultado) {
          const identificadorLeido = resultado.getText()
          detenerCaptura()
          emit('leido', identificadorLeido)
        }
      }
    )
    cargandoHardware.value = false
  } catch (errorDispositivo: any) {
    cargandoHardware.value = false
    
    if (errorDispositivo?.name === 'NotAllowedError') {
      errorInstancia.value = 'Permiso denegado: El navegador restringe el acceso al hardware óptico.'
    } else if (errorDispositivo?.name === 'NotFoundError') {
      errorInstancia.value = 'Fallo de hardware: No se detectó ningún periférico de captura de video.'
    } else if (window.location.protocol === 'http:' && !window.location.hostname.includes('localhost')) {
      errorInstancia.value = 'Seguridad de red: La captura requiere transmisión cifrada HTTPS. Registre el identificador de forma manual.'
    } else {
      errorInstancia.value = `Fallo del subsistema óptico: ${errorDispositivo?.message || 'Excepción desconocida.'}`
    }
  }
})

onBeforeUnmount(detenerCaptura)

/**
 * Procesa e inyecta la entrada alfanumérica manual como respaldo contable.
 */
function despacharEntradaManual() {
  const tokenLimpio = codigoManual.value.trim()
  if (tokenLimpio) {
    detenerCaptura()
    emit('leido', tokenLimpio)
  }
}

function abortarOperacion() {
  detenerCaptura()
  emit('cerrar')
}
</script>

<template>
  <div class="esc-bg" @click.self="abortarOperacion" @keydown.escape="abortarOperacion" tabindex="-1">
    <div class="esc-card card fade-up" role="dialog" aria-modal="true" aria-labelledby="scanner-title">
      
      <div class="esc-header">
        <h3 id="scanner-title">Lector de Código de Barras</h3>
        <button type="button" class="btn-cerrar-top" @click="abortarOperacion" aria-label="Cerrar terminal óptico">×</button>
      </div>

      <div v-if="!errorInstancia" class="video-wrap">
        <video ref="videoRef" class="video" autoplay muted playsinline></video>
        
        <div class="marco" :class="{ 'scanning': !cargandoHardware }">
          <div class="linea-laser" v-if="!cargandoHardware"></div>
        </div>
        
        <p v-if="cargandoHardware" class="status-text text-pulse">Inicializando periférico de video…</p>
        <p v-else class="status-text hint">Alinee el código de barras en el recuadro central</p>
      </div>

      <div v-else class="error-box" role="alert">
        <p class="err-txt">{{ errorInstancia }}</p>
      </div>

      <div class="manual">
        <div class="manual-row">
          <input
            id="manual-input"
            v-model="codigoManual"
            type="text"
            inputmode="numeric"
            class="inp"
            placeholder="O digite el código de barras…"
            autoComplete="off"
            @keyup.enter="despacharEntradaManual"
          />
          <button type="button" class="btn btn-primary" :disabled="!codigoManual.trim()" @click="despacharEntradaManual">
            Agregar
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* Fondo e Inyección de Centrado Absoluto Exacto */
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

/* Tarjeta Modal: Consistencia Estricta de Proporciones */
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

/* Reset protector contra herencias globales de Grid o Flex */
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

/* Área de Renderizado de Video: Forzado Estricto 4:3 */
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

/* Retícula de Enfoque Rectangular Proporcional */
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

/* Línea Láser Dinámica */
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
  0% { top: 0%; }
  50% { top: 100%; }
  100% { top: 0%; }
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
  50% { opacity: 0.5; }
}

/* Bloque de Excepciones de Hardware */
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

/* Entrada Manual Simétrica */
.manual {
  margin-bottom: 0.5rem;
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
  padding: 0 1.4rem;
  font-weight: 600;
  font-size: 0.88rem;
  border-radius: 6px;
  cursor: pointer;
  background: var(--bg-card, #111422);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  color: #ffffff;
  transition: background-color 0.15s;
}

.manual-row .btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.04);
}

.manual-row .btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Animaciones Estándar de Entrada */
.fade-up {
  opacity: 0;
  transform: translateY(8px);
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp { to { opacity: 1; transform: translateY(0); } }

/* Optimización Responsive */
@media (max-width: 560px) {
  .video-wrap {
    aspect-ratio: 16 / 11 !important;
  }
}
</style>