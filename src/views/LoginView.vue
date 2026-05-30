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
      || 'No se pudo iniciar sesión. Verifique sus credenciales.'
  } finally { cargando.value = false }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card fade-up">
      <!-- Encabezado de Marca Corporativa -->
      <div class="brand">
        <span class="dot"></span>
        <h1>Nexus<span class="accent">Store</span></h1>
      </div>
      <p class="tagline">Sistema de Gestión Comercial y Punto de Venta.</p>

      <!-- Formulario de Autenticación Seguro -->
      <form @submit.prevent="entrar" aria-label="Inicio de sesión">
        <div class="field">
          <label for="email">Correo Electrónico</label>
          <input 
            id="email"
            v-model="correo" 
            type="email" 
            placeholder="usuario@dominio.com" 
            autocomplete="username"
            required 
          />
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input 
            id="password"
            v-model="password" 
            type="password" 
            placeholder="••••••••" 
            autocomplete="current-password"
            required 
          />
        </div>
        
        <!-- Retroalimentación de Error de Red / Validación -->
        <p v-if="error" class="error-msg" role="alert">{{ error }}</p>
        
        <button class="btn btn-primary btn-block entrar-btn" :disabled="cargando">
          {{ cargando ? 'Autenticando…' : 'Iniciar Sesión' }}
        </button>
      </form>

      <!-- Pie de Página Informativo -->
      <p class="alt">
        ¿Desea implementar NexusStore en su comercio?
        <span class="contacto">Contacte con soporte.</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-wrap { 
  min-height: 100vh; 
  min-height: 100dvh; 
  display: grid; 
  place-items: center; 
  padding: 1.5rem; 
  background: var(--bg-main, #0c0e17);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.auth-card { 
  width: 100%; 
  max-width: 420px; 
  background: var(--bg-card, #111422); 
  border: 1px solid var(--border, rgba(255,255,255,0.06)); 
  border-radius: var(--radius, 8px); 
  box-shadow: var(--shadow, 0 4px 12px rgba(0,0,0,0.1)); 
  padding: clamp(1.8rem, 1.4rem + 2vw, 2.6rem); 
}

.brand { 
  display: flex; 
  align-items: center; 
  gap: 0.6rem; 
}
.brand h1 { 
  font-size: var(--fs-xl, 1.5rem); 
  font-weight: 800; 
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;
}

.accent { color: var(--accent, #a3e635); }

.dot { 
  width: 12px; 
  height: 12px; 
  border-radius: 50%; 
  background: var(--accent, #a3e635); 
  box-shadow: 0 0 16px var(--accent, rgba(163, 230, 53, 0.5)); 
  flex-shrink: 0; 
}

.tagline { 
  color: var(--text-dim, #64748b); 
  margin: 0.5rem 0 2rem; 
  font-size: 0.9rem;
  font-weight: 500;
}

/* Campos del Formulario */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.2rem;
}
.field label {
  color: #cbd5e1;
  font-size: 0.82rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.field input {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border, rgba(255,255,255,0.06));
  border-radius: 6px;
  padding: 0.75rem 1rem;
  color: #ffffff;
  font-size: 0.95rem;
  transition: border-color 0.2s, background 0.2s;
}
.field input:focus {
  outline: none;
  border-color: var(--accent, #a3e635);
  background: rgba(255, 255, 255, 0.05);
}

/* Mensajes de Error */
.error-msg {
  color: #f87171;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.15);
  padding: 0.65rem 0.85rem;
  border-radius: 6px;
  font-size: 0.82rem;
  margin: 0 0 1.2rem 0;
  font-weight: 500;
}

/* Botones de Acción */
.entrar-btn { 
  width: 100%;
  padding: 0.8rem;
  background: var(--accent, #a3e635);
  border: none;
  border-radius: 6px;
  color: #0c0e17;
  font-weight: 600;
  font-size: var(--fs-md, 0.95rem);
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}
.entrar-btn:hover:not(:disabled) {
  background: #bef264;
}
.entrar-btn:active:not(:disabled) {
  transform: scale(0.99);
}
.entrar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.alt { 
  margin-top: 1.8rem; 
  text-align: center; 
  color: var(--text-dim, #64748b); 
  font-size: var(--fs-sm, 0.82rem); 
  line-height: 1.4;
}
.contacto { 
  color: var(--accent, #a3e635); 
  font-weight: 600; 
  display: block;
  margin-top: 0.2rem;
  cursor: pointer;
}
.contacto:hover {
  text-decoration: underline;
}

/* Animación de entrada */
.fade-up {
  opacity: 0;
  transform: translateY(8px);
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slideUp {
  to { opacity: 1; transform: translateY(0); }
}
</style>