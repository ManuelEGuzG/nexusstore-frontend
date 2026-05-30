<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

// --- Control de Identidades y Roles ---
interface Usuario { 
  id: number
  name: string
  email: string
  rol: 'dueño' | 'cajero' | string
  activo: boolean 
}

const usuarios = ref<Usuario[]>([])
const mostrarNuevoUser = ref(false)
const uNombre = ref('')
const uCorreo = ref('')
const uPass = ref('')
const uRol = ref('cajero')
const errUser = ref('')

// --- Infraestructura de Autenticación de Doble Factor (2FA) ---
const tfaActivo = ref(false)
const mostrar2fa = ref(false)
const qrSvgHtml = ref('')
const secret = ref('')
const codigo2fa = ref('')
const err2fa = ref('')

async function cargar() {
  try {
    if (auth.esDueno) {
      const { data } = await api.get('/users')
      usuarios.value = data || []
    }
    const { data: est } = await api.get('/2fa/estado')
    tfaActivo.value = !!est?.activo
  } catch {
    /* Mitigación preventiva de excepciones en la sincronización de credenciales */
  }
}

onMounted(cargar)

async function crearUsuario() {
  errUser.value = ''
  try {
    await api.post('/users', {
      nombre: uNombre.value.trim(),
      correo: uCorreo.value.trim(),
      password: uPass.value,
      rol: uRol.value,
    })
    uNombre.value = ''
    uCorreo.value = ''
    uPass.value = ''
    uRol.value = 'cajero'
    mostrarNuevoUser.value = false
    await cargar()
  } catch (e: any) {
    errUser.value = e.response?.data?.errors?.correo?.[0]
      || e.response?.data?.message || 'Error operativo al dar de alta el usuario.'
  }
}

async function toggleActivo(u: Usuario) {
  try {
    await api.put(`/users/${u.id}`, { activo: !u.activo })
    await cargar()
  } catch {
    alert('No se pudo modificar el estado de suspensión del usuario.')
  }
}

async function eliminarUsuario(u: Usuario) {
  if (!confirm(`¿Confirmar la revocación definitiva del acceso para: "${u.name}"?`)) return
  try {
    await api.delete(`/users/${u.id}`)
    await cargar()
  } catch (e: any) {
    alert(e.response?.data?.message || 'Restricción de seguridad: No fue posible eliminar el registro.')
  }
}

async function iniciar2fa() {
  err2fa.value = ''
  try {
    const { data } = await api.post('/2fa/generar')
    if (data?.qr_svg_base64) {
      qrSvgHtml.value = atob(data.qr_svg_base64)
    } else {
      qrSvgHtml.value = ''
    }
    secret.value = data?.secret || ''
    mostrar2fa.value = true
  } catch {
    alert('Error al inicializar la llave del token criptográfico.')
  }
}

async function activar2fa() {
  err2fa.value = ''
  try {
    await api.post('/2fa/activar', { secret: secret.value, codigo: codigo2fa.value.trim() })
    mostrar2fa.value = false
    codigo2fa.value = ''
    await cargar()
  } catch (e: any) {
    err2fa.value = e.response?.data?.message || 'Código de verificación inválido o expirado.'
  }
}

async function desactivar2fa() {
  if (!confirm('¿Solicitar la desactivación de la política estricta de autenticación en dos pasos (2FA)?')) return
  try {
    await api.post('/2fa/desactivar')
    await cargar()
  } catch {
    alert('No se pudo revocar la configuración de seguridad remota.')
  }
}
</script>

<template>
  <div class="wrap fade-up">
    <header class="top">
      <button class="back" @click="router.push('/')" aria-label="Retornar al menú principal">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
      </button>
      <h1>Ajustes de Seguridad y Sistema</h1>
    </header>

    <section class="card panel">
      <h2>Autenticación de Doble Factor (2FA)</h2>
      <p class="dim">Incorpore una capa de protección robusta requiriendo un token dinámico desde su dispositivo móvil al autenticarse.</p>
      
      <div class="estado-2fa">
        <span class="chip" :class="tfaActivo ? 'on' : 'off'">
          <span class="dot"></span>
          {{ tfaActivo ? 'Directiva Activa' : 'Inactivo' }}
        </span>
        <button v-if="!tfaActivo" class="btn btn-primary" @click="iniciar2fa">Habilitar 2FA</button>
        <button v-else class="btn btn-ghost" @click="desactivar2fa">Desactivar Protección</button>
      </div>
    </section>

    <section v-if="auth.esDueno" class="card panel">
      <div class="panel-head">
        <h2>Directorio de Personal y Accesos</h2>
        <button class="btn btn-primary mini-btn" @click="mostrarNuevoUser = true">+ Registrar Usuario</button>
      </div>
      
      <ul class="user-list">
        <li v-for="u in usuarios" :key="u.id" class="user-item">
          <div class="u-meta">
            <span class="u-nombre">{{ u.name }}</span>
            <span class="u-rol" :class="{ 'dueno': u.rol === 'dueño' }">
              {{ u.rol === 'dueño' ? 'Administrador' : 'Operador / Cajero' }}
            </span>
          </div>
          <div class="u-acciones">
            <button 
              class="u-btn" 
              :class="{ 'u-btn-active': u.activo }"
              @click="toggleActivo(u)"
            >
              {{ u.activo ? 'Vigente' : 'Suspendido' }}
            </button>
            <button 
              v-if="u.id !== auth.user?.id" 
              class="u-del" 
              @click="eliminarUsuario(u)"
              title="Revocar credenciales de acceso"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </li>
      </ul>
    </section>

    <div v-if="mostrarNuevoUser" class="modal-bg" @click.self="mostrarNuevoUser = false">
      <div class="modal card">
        <h3>Alta de Usuario del Sistema</h3>
        
        <div class="field">
          <label for="u-nombre">Nombre de la Identidad</label>
          <input id="u-nombre" v-model="uNombre" placeholder="Ej. Mariana Fonseca" required />
        </div>
        
        <div class="field">
          <label for="u-correo">Correo Electrónico Institucional</label>
          <input id="u-correo" v-model="uCorreo" type="email" placeholder="usuario@nexusstore.com" required />
        </div>
        
        <div class="field">
          <label for="u-pass">Contraseña Temporal de Acceso</label>
          <input id="u-pass" v-model="uPass" type="password" placeholder="Mínimo 8 caracteres" required />
        </div>
        
        <div class="field">
          <label for="u-rol">Nivel de Privilegios (Rol)</label>
          <select id="u-rol" v-model="uRol" class="sel">
            <option value="cajero">Operador / Cajero (Ventas e Inventario básico)</option>
            <option value="dueño">Administrador Corporativo (Acceso Completo)</option>
          </select>
        </div>
        
        <p v-if="errUser" class="error-msg" role="alert">{{ errUser }}</p>
        
        <div class="modal-acciones">
          <button class="btn btn-ghost" @click="mostrarNuevoUser = false">Cancelar</button>
          <button class="btn btn-primary" @click="crearUsuario">Crear Cuenta</button>
        </div>
      </div>
    </div>

    <div v-if="mostrar2fa" class="modal-bg" @click.self="mostrar2fa = false">
      <div class="modal card">
        <h3>Alineación de Token Criptográfico</h3>
        <p class="dim">Sincronice este identificador visual en su aplicación autenticadora (Google Authenticator, Microsoft Authenticator o Bitwarden):</p>
        
        <div class="qr-wrapper">
          <div class="qr" v-html="qrSvgHtml"></div>
        </div>
        
        <p class="secret-txt">Semilla de respaldo manual: <code>{{ secret }}</code></p>
        
        <div class="field">
          <label for="f-token">Código Verificador Dinámico (6 dígitos)</label>
          <input 
            id="f-token" 
            v-model="codigo2fa" 
            inputmode="numeric" 
            pattern="[0-9]*" 
            placeholder="000 000" 
            maxlength="6"
            class="font-mono-input"
          />
        </div>
        
        <p v-if="err2fa" class="error-msg" role="alert">{{ err2fa }}</p>
        
        <div class="modal-acciones">
          <button class="btn btn-ghost" @click="mostrar2fa = false">Cancelar</button>
          <button class="btn btn-primary" @click="activar2fa">Validar y Enlazar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap {
  padding: clamp(1rem, 3vw, 2rem);
  max-width: 680px;
  margin: 0 auto;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.top {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.top h1 {
  flex: 1;
  font-size: clamp(1.2rem, 3vw, 1.6rem);
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  letter-spacing: -0.02em;
}

.back {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #cbd5e1;
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.back:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.panel { padding: 1.6rem; margin-bottom: 1.25rem; }
.panel h2 { font-size: 1.15rem; margin-bottom: 0.4rem; font-weight: 700; color: #ffffff; letter-spacing: -0.01em; }
.dim { color: #64748b; font-size: 0.88rem; line-height: 1.4; }

.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; gap: 1rem; }
.panel-head h2 { margin-bottom: 0; }
.mini-btn { padding: 0.5rem 0.9rem; font-size: 0.82rem; font-weight: 600; border-radius: 6px; height: 36px; }

/* Control del Módulo 2FA */
.estado-2fa { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-top: 1.2rem; flex-wrap: wrap; }
.chip { font-size: 0.78rem; font-weight: 700; padding: 0.35rem 0.8rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.4rem; text-transform: uppercase; letter-spacing: 0.02em; }
.chip.on { background: rgba(34, 197, 94, 0.1); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.15); }
.chip.off { background: rgba(148, 163, 184, 0.1); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.15); }

.dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* Grid de Usuarios de Alta */
.user-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.user-item { display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; gap: 1rem; }
.u-meta { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.u-nombre { font-weight: 600; color: #f1f5f9; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.u-rol { font-size: 0.76rem; color: #64748b; font-weight: 500; }
.u-rol.dueno { color: var(--accent, #a3e635); font-weight: 600; }

.u-acciones { display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; }
.u-btn { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.06); color: #94a3b8; padding: 0.35rem 0.75rem; border-radius: 4px; cursor: pointer; font-size: 0.78rem; font-weight: 600; transition: all 0.2s; }
.u-btn-active { border-color: rgba(34, 197, 94, 0.2); color: #4ade80; background: rgba(34, 197, 94, 0.05); }

.u-del { background: transparent; border: none; color: rgba(255,255,255,0.2); cursor: pointer; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 4px; transition: all 0.15s; }
.u-del:hover { color: #f87171; background: rgba(239, 68, 68, 0.08); }

/* Inyección Vectorial QR y Criptografía */
.qr-wrapper { display: flex; justify-content: center; margin: 1.2rem 0; background: #ffffff; padding: 1.2rem; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.05); }
.qr { display: inline-flex; }
.qr :deep(svg) { width: 180px; height: 180px; display: block; }

.secret-txt { font-size: 0.78rem; color: #64748b; text-align: center; margin-bottom: 1.2rem; background: rgba(0,0,0,0.15); padding: 0.5rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.02); }
.secret-txt code { color: var(--accent, #a3e635); font-family: monospace; font-weight: 600; word-break: break-all; }

.font-mono-input { font-family: monospace; font-size: 1.2rem !important; letter-spacing: 0.3em; text-align: center; }
.font-mono-input::placeholder { letter-spacing: normal; font-family: sans-serif; font-size: 0.92rem; }

/* Controladores Modales y Formularios */
.field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.1rem; }
.field label { color: #cbd5e1; font-size: 0.82rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.field input, .sel {
  background: rgba(0,0,0,0.15);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 6px;
  padding: 0.7rem 0.9rem;
  color: #ffffff;
  font-size: 0.92rem;
  width: 100%;
}
.field input:focus, .sel:focus { outline: none; border-color: var(--accent, #a3e635); }
.sel { min-height: 44px; appearance: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>"); background-repeat: no-repeat; background-position: right 0.75rem center; background-size: 1rem; padding-right: 2.5rem; }

.error-msg { color: #f87171; background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 0.6rem 0.8rem; border-radius: 4px; font-size: 0.82rem; margin: 0 0 1.1rem 0; font-weight: 500; }

.modal-bg { position: fixed; inset: 0; background: rgba(6, 8, 13, 0.85); display: grid; place-items: center; padding: 1rem; z-index: 100; backdrop-filter: blur(4px); }
.modal { padding: 1.6rem; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.4); }
.modal h3 { margin: 0 0 1.2rem 0; font-size: 1.2rem; color: #ffffff; font-weight: 700; letter-spacing: -0.01em; }

.modal-acciones { display: flex; gap: 0.75rem; margin-top: 1.4rem; }
.modal-acciones .btn { flex: 1; height: 40px; font-weight: 600; }

/* Animación Estándar de Entrada */
.fade-up {
  opacity: 0;
  transform: translateY(6px);
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slideUp { to { opacity: 1; transform: translateY(0); } }

.modal::-webkit-scrollbar { width: 4px; }
.modal::-webkit-scrollbar-track { background: transparent; }
.modal::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
</style>