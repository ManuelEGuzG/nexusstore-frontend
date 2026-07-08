<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

// Formulario y Estados
const correo = ref('')
const password = ref('')
const cargando = ref(false)
const error = ref('')

// Referencia del Canvas
const canvasRef = ref<HTMLCanvasElement | null>(null)

async function entrar() {
  error.value = ''
  cargando.value = true
  try {
    await auth.login(correo.value, password.value)
    router.push({ name: 'inicio' })
  } catch (e: any) {
    error.value =
      e.response?.data?.message ||
      e.response?.data?.errors?.correo?.[0] ||
      'No se pudo iniciar sesión. Verifique sus credenciales.'
  } finally {
    cargando.value = false
  }
}

/* ---------- Lógica de Red de Partículas Interactiva ---------- */
let particles: Array<{ x: number; y: number; vx: number; vy: number; r: number; op: number }> = []
let mouse = { x: -9999, y: -9999, active: false }
let width = 0
let height = 0
let dpr = 1
let animationFrameId: number

function getStyleTokens() {
  return {
    particle: 'rgba(163, 230, 53, 0.85)',
    line: 'rgba(163, 230, 53, 0.12)',
  }
}

function resize() {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  width = window.innerWidth
  height = window.innerHeight
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = width + 'px'
  canvas.style.height = height + 'px'
  const ctx = canvas.getContext('2d')
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  seedParticles()
}

function seedParticles() {
  const area = width * height
  const target = Math.min(120, Math.max(30, Math.round(area / 11000)))
  particles = []
  for (let i = 0; i < target; i++) particles.push(createParticle())
}

function createParticle(x?: number, y?: number) {
  return {
    x: x ?? Math.random() * width,
    y: y ?? Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    r: Math.random() * 1.5 + 1.2,
    op: Math.random() * 0.4 + 0.3,
  }
}

function step() {
  if (!canvasRef.value) return
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const tokens = getStyleTokens()
  ctx.clearRect(0, 0, width, height)

  for (const p of particles) {
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0 || p.x > width) p.vx *= -1
    if (p.y < 0 || p.y > height) p.vy *= -1
    p.x = Math.max(0, Math.min(width, p.x))
    p.y = Math.max(0, Math.min(height, p.y))

    if (mouse.active) {
      const dx = mouse.x - p.x
      const dy = mouse.y - p.y
      const d = Math.hypot(dx, dy)
      if (d < 200) {
        const f = (1 - d / 200) * 0.3
        p.vx += (dx / (d || 1)) * f * 0.05
        p.vy += (dy / (d || 1)) * f * 0.05
      }
    }
    p.vx *= 0.99
    p.vy *= 0.99
  }

  const maxDist = 150
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const a = particles[i]
      const b = particles[j]
      if (!a || !b) continue

      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (d < maxDist) {
        ctx.strokeStyle = tokens.line
        ctx.globalAlpha = (1 - d / maxDist) * 0.3
        ctx.lineWidth = 1.0
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }
  }

  if (mouse.active) {
    for (const p of particles) {
      const d = Math.hypot(p.x - mouse.x, p.y - mouse.y)
      if (d < 200) {
        ctx.strokeStyle = tokens.particle
        ctx.globalAlpha = (1 - d / 200) * 0.4
        ctx.lineWidth = 1.1
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(mouse.x, mouse.y)
        ctx.stroke()
      }
    }
  }

  for (const p of particles) {
    ctx.fillStyle = tokens.particle
    ctx.globalAlpha = p.op
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1.0

  animationFrameId = requestAnimationFrame(step)
}

function handleMouseMove(e: MouseEvent) {
  mouse.x = e.clientX
  mouse.y = e.clientY
  mouse.active = true
}

function handleMouseLeave() {
  mouse.active = false
}

function handleCanvasClick(e: MouseEvent) {
  for (let i = 0; i < 4; i++) {
    const p = createParticle(
      e.clientX + (Math.random() - 0.5) * 15,
      e.clientY + (Math.random() - 0.5) * 15,
    )
    p.vx = (Math.random() - 0.5) * 2
    p.vy = (Math.random() - 0.5) * 2
    particles.push(p)
  }
  if (particles.length > 180) particles.splice(0, 4)
}

onMounted(() => {
  window.addEventListener('resize', resize)
  resize()
  animationFrameId = requestAnimationFrame(step)
})

onUnmounted(() => {
  window.removeEventListener('resize', resize)
  cancelAnimationFrame(animationFrameId)
})
</script>

<template>
  <div class="auth-wrap">
    <div class="grid-overlay"></div>
    <canvas
      ref="canvasRef"
      class="particles-canvas"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      @click="handleCanvasClick"
    ></canvas>
    <div class="vignette"></div>

    <main class="ui-container">
      <div class="auth-card fade-up glass">
        <div class="brand">
          <span class="dot"></span>
          <h1>Nexus<span class="accent">Store</span></h1>
        </div>
        <p class="tagline">Sistema de Gestión Comercial y Punto de Venta.</p>

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

          <transition name="fade">
            <p v-if="error" class="error-msg" role="alert">{{ error }}</p>
          </transition>

          <button class="entrar-btn" :disabled="cargando">
            <span v-if="cargando" class="spinner-container">
              <svg class="animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Autenticando…
            </span>
            <span v-else>Iniciar Sesión</span>
          </button>
        </form>

        <div class="alt">
          <p>¿Desea implementar NexusStore en su comercio?</p>
          <span class="contacto">Contacte con soporte</span>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* Contenedor Base Absoluto con Grid de Centrado */
.auth-wrap {
  position: relative;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  display: grid;
  place-items: center;
  background: #000000; /* Negro liso absoluto */
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.ui-container {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 440px;
  padding: 1.5rem;
  box-sizing: border-box;
}

/* Capas del Canvas e Interfaz de Fondo */
.particles-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: block;
  cursor: default;
}

.grid-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.008) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.008) 1px, transparent 1px);
  background-size: 60px 60px;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
}

.vignette {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.8) 100%);
}

/* Estructura Glassmorphic de la Tarjeta adaptada a Negro Liso */
.glass {
  background: rgba(10, 10, 10, 0.7); /* Oscuro muy profundo */
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08); /* Borde minimalista ultra-fino */
}

.auth-card {
  width: 100%;
  border-radius: var(--radius, 20px);
  box-shadow: 0 30px 70px rgba(0, 0, 0, 0.9); /* Sombra pesada para separarla del fondo puro */
  padding: clamp(1.8rem, 5vw, 2.5rem);
  box-sizing: border-box;
}

/* Encabezado e Identidad Corporativa */
.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  margin-top: 0.5rem;
}

.brand h1 {
  font-size: var(--fs-xl, 1.65rem);
  font-weight: 800;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1;
}

.accent {
  color: var(--accent, #a3e635);
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent, #a3e635);
  box-shadow: 0 0 14px var(--accent, #a3e635);
  flex-shrink: 0;
}

.tagline {
  text-align: center;
  color: #64748b;
  margin: 0.6rem 0 2rem 0;
  font-size: 0.88rem;
  font-weight: 400;
}

/* Campos de Texto y Etiquetas del Formulario */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-bottom: 1.25rem;
}

.field label {
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.field input {
  background: rgba(0, 0, 0, 0.5); /* Más oscuro para contraste interno */
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-sm, 10px);
  padding: 0.8rem 1rem;
  color: #ffffff;
  font-size: 0.95rem;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.field input:focus {
  outline: none;
  border-color: var(--accent, #a3e635);
  background: rgba(0, 0, 0, 0.7);
  box-shadow: 0 0 0 3px rgba(163, 230, 53, 0.15);
}

/* Errores */
.error-msg {
  color: #f87171;
  background: rgba(239, 68, 68, 0.07);
  border: 1px solid rgba(239, 68, 68, 0.15);
  padding: 0.7rem 0.9rem;
  border-radius: 8px;
  font-size: 0.82rem;
  margin-bottom: 1.25rem;
  font-weight: 500;
}

/* Botón Primario */
.entrar-btn {
  width: 100%;
  padding: 0.85rem;
  background: var(--accent, #b8ff3c);
  border: none;
  border-radius: var(--radius-sm, 10px);
  color: #000000; /* Aseguramos contraste total */
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  margin-top: 0.5rem;
  transition:
    background 0.2s,
    transform 0.1s,
    box-shadow 0.2s;
  box-shadow: 0 4px 20px rgba(184, 255, 60, 0.25);
}

.entrar-btn:hover:not(:disabled) {
  background: #c3ff55;
  box-shadow: 0 6px 24px rgba(184, 255, 60, 0.45);
}

.entrar-btn:active:not(:disabled) {
  transform: scale(0.985);
}

.entrar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

/* Pie de Página */
.alt {
  margin-top: 1.85rem;
  text-align: center;
  color: #64748b;
  font-size: 0.82rem;
  line-height: 1.5;
}

.contacto {
  color: var(--accent, #a3e635);
  font-weight: 600;
  display: inline-block;
  margin-top: 0.2rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.contacto:hover {
  text-decoration: underline;
  opacity: 0.9;
}

/* Animaciones */
.fade-up {
  opacity: 0;
  transform: translateY(15px);
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-spin {
  width: 1rem;
  height: 1rem;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
