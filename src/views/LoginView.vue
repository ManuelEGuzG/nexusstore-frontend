<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const correo = ref('')
const password = ref('')
const cargando = ref(false)
const error = ref('')

async function entrar() {
  error.value = ''
  cargando.value = true
  try {
    await auth.login(correo.value, password.value)
    router.push({ name: 'inicio' })
  } catch (e: any) {
    error.value = e.response?.data?.message
      || e.response?.data?.errors?.correo?.[0]
      || 'No se pudo iniciar sesión. Revisá tus datos.'
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
      <p class="tagline">Tu pulpería, al día.</p>

      <form @submit.prevent="entrar">
        <div class="field">
          <label>Correo</label>
          <input v-model="correo" type="email" placeholder="vos@ejemplo.com" required />
        </div>
        <div class="field">
          <label>Contraseña</label>
          <input v-model="password" type="password" placeholder="••••••••" required />
        </div>
        <p v-if="error" class="error-msg">{{ error }}</p>
        <button class="btn btn-primary btn-block entrar-btn" :disabled="cargando">
          {{ cargando ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>

      <p class="alt">
        ¿Querés NexusStore para tu pulpería?
        <span class="contacto">Escribinos.</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-wrap { min-height: 100vh; min-height: 100dvh; display: grid; place-items: center; padding: 1.5rem; }
.auth-card { width: 100%; max-width: 420px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: clamp(1.8rem, 1.4rem + 2vw, 2.6rem); }
.brand { display: flex; align-items: center; gap: 0.6rem; }
.brand h1 { font-size: var(--fs-xl); font-weight: 800; }
.accent { color: var(--accent); }
.dot { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 16px var(--accent); flex-shrink: 0; }
.tagline { color: var(--text-dim); margin: 0.5rem 0 2rem; }
.entrar-btn { margin-top: 0.5rem; font-size: var(--fs-md); }
.alt { margin-top: 1.5rem; text-align: center; color: var(--text-dim); font-size: var(--fs-sm); }
.contacto { color: var(--accent); font-weight: 600; }
</style>