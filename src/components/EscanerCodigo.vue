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

let reader: BrowserMultiFormatReader | null = null
let controls: IScannerControls | null = null

onMounted(async () => {
  // El acceso a la cámara requiere HTTPS o localhost.
  // En la red local (http://192.168.x.x) algunos navegadores lo permiten,
  // otros no. Si falla, avisamos al usuario.
  try {
    reader = new BrowserMultiFormatReader()

    // undefined = cámara por defecto (trasera en celulares)
    controls = await reader.decodeFromVideoDevice(
      undefined,
      videoRef.value!,
      (result, err) => {
        if (result) {
          const codigo = result.getText()
          detener()
          emit('leido', codigo)
        }
        // err en cada frame sin lectura es normal, lo ignoramos
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
      error.value = 'La cámara necesita HTTPS. Funcionará al desplegar; por ahora podés escribir el código a mano.'
    } else {
      error.value = 'No se pudo abrir la cámara: ' + (e?.message || 'error desconocido')
    }
  }
})

function detener() {
  try {
    controls?.stop()
  } catch {
    // ignore
  }
  controls = null
}

onBeforeUnmount(detener)

// Entrada manual como respaldo (cuando no hay cámara o HTTPS)
const manual = ref('')
function enviarManual() {
  if (manual.value.trim()) {
    detener()
    emit('leido', manual.value.trim())
  }
}
</script>

<template>
  <div class="esc-bg">
    <div class="esc-card card">
      <div class="esc-header">
        <h3>Escanear código</h3>
        <button class="cerrar" @click="detener(); emit('cerrar')">×</button>
      </div>

      <div v-if="!error" class="video-wrap">
        <video ref="videoRef" class="video" autoplay muted playsinline></video>
        <div class="marco"></div>
        <p v-if="cargando" class="cargando">Abriendo cámara…</p>
        <p v-else class="hint">Apuntá al código de barras</p>
      </div>

      <div v-else class="error-box">
        <p class="err-txt">{{ error }}</p>
      </div>

      <!-- Respaldo: escribir el código a mano -->
      <div class="manual">
        <p class="manual-label">…o escribí el código:</p>
        <div class="manual-row">
          <input
            v-model="manual"
            type="text"
            inputmode="numeric"
            placeholder="Código de barras"
            @keyup.enter="enviarManual"
          />
          <button class="btn btn-primary" @click="enviarManual">Usar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.esc-bg {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75);
  display: grid; place-items: center; padding: 1rem; z-index: 70;
  backdrop-filter: blur(4px);
}
.esc-card { padding: 1.4rem; width: 100%; max-width: 400px; }
.esc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.esc-header h3 { font-size: 1.2rem; }
.cerrar { background: none; border: none; color: var(--text-dim); font-size: 1.8rem; cursor: pointer; line-height: 1; }
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
.error-box { padding: 1.5rem; background: var(--bg-elev); border-radius: var(--radius-sm); margin-bottom: 1rem; }
.err-txt { color: var(--warn); font-size: 0.92rem; line-height: 1.5; }
.manual { border-top: 1px solid var(--border); padding-top: 1rem; }
.manual-label { color: var(--text-dim); font-size: 0.85rem; margin-bottom: 0.5rem; }
.manual-row { display: flex; gap: 0.6rem; }
.manual-row input {
  flex: 1; background: var(--bg-elev); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 0.7rem; color: var(--text); min-height: 48px;
}
.manual-row input:focus { outline: none; border-color: var(--accent); }
</style>