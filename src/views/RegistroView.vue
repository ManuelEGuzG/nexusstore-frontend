<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const nombre = ref('')
const correo = ref('')
const password = ref('')
const tiendaNombre = ref('')
const cargando = ref(false)
const error = ref('')

async function crear() {
  error.value = ''
  cargando.value = true
  try {
    await auth.registrar({
      nombre: nombre.value, correo: correo.value, password: password.value,
      tienda_nombre: tiendaNombre.value, moneda: 'CRC',
    })
    router.push({ name: 'pos' })
  } catch (e: any) {
    const errs = e.response?.data?.errors
    error.value = errs?.correo?.[0] || errs?.password?.[0]
      || e.response?.data?.message || 'No se pudo crear la tienda.'
  } finally { cargando.value = false }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card fade-up">
      <div class="brand">
        <span class="dot"></span>
        <h1>Nexus<span class="accent">Store</span></h1>
      </div>
      <p class="tagline">Creá tu tienda en menos de un minuto.</p>

      <form @submit.prevent="crear">
        <div class="field"><label>Tu nombre</label><input v-model="nombre" type="text" placeholder="Manuel" required /></div>
        <div class="field"><label>Nombre de la pulpería</label><input v-model="tiendaNombre" type="text" placeholder="Pulpería La Esquina" required /></div>
        <div class="field"><label>Correo</label><input v-model="correo" type="email" placeholder="vos@ejemplo.com" required /></div>
        <div class="field"><label>Contraseña</label><input v-model="password" type="password" placeholder="mínimo 8 caracteres" required /></div>
        <p v-if="error" class="error-msg">{{ error }}</p>
        <button class="btn btn-primary btn-block crear-btn" :disabled="cargando">
          {{ cargando ? 'Creando…' : 'Crear mi tienda y empezar' }}
        </button>
      </form>

      <p class="alt">¿Ya tenés cuenta? <RouterLink to="/login" class="link">Entrá aquí</RouterLink></p>
    </div>
  </div>
</template>

<style scoped>
.auth-wrap { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 1.5rem; }
.auth-card { width: 100%; max-width: 440px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: clamp(1.8rem, 1.4rem + 2vw, 2.6rem); }
.brand { display: flex; align-items: center; gap: 0.6rem; }
.brand h1 { font-size: var(--fs-xl); font-weight: 800; }
.accent { color: var(--accent); }
.dot { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 16px var(--accent); flex-shrink: 0; }
.tagline { color: var(--text-dim); margin: 0.5rem 0 2rem; }
.crear-btn { margin-top: 0.5rem; font-size: var(--fs-md); }
.alt { margin-top: 1.5rem; text-align: center; color: var(--text-dim); font-size: var(--fs-sm); }
.link { color: var(--accent); font-weight: 600; text-decoration: none; }
.link:hover { text-decoration: underline; }
</style>