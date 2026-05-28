<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

// --- Usuarios ---
interface Usuario { id: number; name: string; email: string; rol: string; activo: boolean }
const usuarios = ref<Usuario[]>([])
const mostrarNuevoUser = ref(false)
const uNombre = ref('')
const uCorreo = ref('')
const uPass = ref('')
const uRol = ref('cajero')
const errUser = ref('')

// --- 2FA ---
const tfaActivo = ref(false)
const mostrar2fa = ref(false)
const qrSvgHtml = ref('')
const secret = ref('')
const codigo2fa = ref('')
const err2fa = ref('')

async function cargar() {
  if (auth.esDueno) {
    const { data } = await api.get('/users')
    usuarios.value = data
  }
  const { data: est } = await api.get('/2fa/estado')
  tfaActivo.value = est.activo
}

onMounted(cargar)

async function crearUsuario() {
  errUser.value = ''
  try {
    await api.post('/users', {
      nombre: uNombre.value,
      correo: uCorreo.value,
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
      || e.response?.data?.message || 'No se pudo crear.'
  }
}

async function toggleActivo(u: Usuario) {
  await api.put(`/users/${u.id}`, { activo: !u.activo })
  await cargar()
}

async function eliminarUsuario(u: Usuario) {
  if (!confirm(`¿Eliminar a ${u.name}?`)) return
  try {
    await api.delete(`/users/${u.id}`)
    await cargar()
  } catch (e: any) {
    alert(e.response?.data?.message || 'No se pudo eliminar.')
  }
}

async function iniciar2fa() {
  err2fa.value = ''
  const { data } = await api.post('/2fa/generar')
  // El QR viene como SVG en base64; lo decodificamos para inyectarlo
  try {
    qrSvgHtml.value = atob(data.qr_svg_base64)
  } catch {
    qrSvgHtml.value = ''
  }
  secret.value = data.secret
  mostrar2fa.value = true
}

async function activar2fa() {
  err2fa.value = ''
  try {
    await api.post('/2fa/activar', { secret: secret.value, codigo: codigo2fa.value })
    mostrar2fa.value = false
    codigo2fa.value = ''
    await cargar()
  } catch (e: any) {
    err2fa.value = e.response?.data?.message || 'Código incorrecto.'
  }
}

async function desactivar2fa() {
  if (!confirm('¿Desactivar la verificación en dos pasos?')) return
  await api.post('/2fa/desactivar')
  await cargar()
}
</script>

<template>
  <div class="wrap">
    <header class="top">
      <button class="btn btn-ghost mini" @click="router.push('/')">←</button>
      <h1>Configuración</h1>
    </header>

    <!-- Seguridad / 2FA -->
    <section class="card panel">
      <h2>Verificación en dos pasos</h2>
      <p class="dim">Pedí un código de tu teléfono al iniciar sesión. Más seguro para el dueño.</p>
      <div class="estado-2fa">
        <span class="chip" :class="tfaActivo ? 'on' : 'off'">
          {{ tfaActivo ? 'Activado' : 'Desactivado' }}
        </span>
        <button v-if="!tfaActivo" class="btn btn-primary" @click="iniciar2fa">Activar 2FA</button>
        <button v-else class="btn btn-ghost" @click="desactivar2fa">Desactivar</button>
      </div>
    </section>

    <!-- Usuarios (solo dueño) -->
    <section v-if="auth.esDueno" class="card panel">
      <div class="panel-head">
        <h2>Usuarios y cajeros</h2>
        <button class="btn btn-primary mini" @click="mostrarNuevoUser = true">+ Usuario</button>
      </div>
      <ul class="user-list">
        <li v-for="u in usuarios" :key="u.id" class="user-item">
          <div>
            <span class="u-nombre">{{ u.name }}</span>
            <span class="u-rol" :class="u.rol === 'dueño' ? 'dueno' : ''">{{ u.rol }}</span>
          </div>
          <div class="u-acciones">
            <button class="u-btn" @click="toggleActivo(u)">
              {{ u.activo ? 'Activo' : 'Inactivo' }}
            </button>
            <button v-if="u.id !== auth.user?.id" class="u-del" @click="eliminarUsuario(u)">×</button>
          </div>
        </li>
      </ul>
    </section>

    <!-- Modal nuevo usuario -->
    <div v-if="mostrarNuevoUser" class="modal-bg" @click.self="mostrarNuevoUser = false">
      <div class="modal card">
        <h3>Nuevo usuario</h3>
        <div class="field"><label>Nombre</label><input v-model="uNombre" /></div>
        <div class="field"><label>Correo</label><input v-model="uCorreo" type="email" /></div>
        <div class="field"><label>Contraseña</label><input v-model="uPass" type="password" /></div>
        <div class="field">
          <label>Rol</label>
          <select v-model="uRol" class="sel">
            <option value="cajero">Cajero</option>
            <option value="dueño">Dueño</option>
          </select>
        </div>
        <p v-if="errUser" class="error-msg">{{ errUser }}</p>
        <div class="modal-acciones">
          <button class="btn btn-ghost" @click="mostrarNuevoUser = false">Cancelar</button>
          <button class="btn btn-primary" @click="crearUsuario">Crear</button>
        </div>
      </div>
    </div>

    <!-- Modal 2FA -->
    <div v-if="mostrar2fa" class="modal-bg" @click.self="mostrar2fa = false">
      <div class="modal card">
        <h3>Activar 2FA</h3>
        <p class="dim">Escaneá este código con Google Authenticator (o similar):</p>
        <div class="qr" v-html="qrSvgHtml"></div>
        <p class="secret-txt">O ingresá manualmente: <code>{{ secret }}</code></p>
        <div class="field">
          <label>Código de 6 dígitos</label>
          <input v-model="codigo2fa" inputmode="numeric" placeholder="000000" />
        </div>
        <p v-if="err2fa" class="error-msg">{{ err2fa }}</p>
        <div class="modal-acciones">
          <button class="btn btn-ghost" @click="mostrar2fa = false">Cancelar</button>
          <button class="btn btn-primary" @click="activar2fa">Confirmar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { max-width: 640px; margin: 0 auto; padding: 1rem 1.25rem 4rem; }
.top { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.top h1 { font-size: 1.5rem; }
.mini { min-height: 42px; padding: 0.5rem 0.9rem; }
.dim { color: var(--text-dim); font-size: 0.9rem; }
.panel { padding: 1.6rem; margin-bottom: 1.25rem; }
.panel h2 { font-size: 1.15rem; margin-bottom: 0.5rem; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.panel-head h2 { margin-bottom: 0; }
.estado-2fa { display: flex; align-items: center; gap: 1rem; margin-top: 1rem; }
.chip { font-size: 0.8rem; font-weight: 600; padding: 0.4rem 0.9rem; border-radius: 999px; }
.chip.on { background: rgba(52,211,153,0.15); color: var(--ok); }
.chip.off { background: rgba(154,163,178,0.15); color: var(--text-dim); }
.user-list { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
.user-item { display: flex; justify-content: space-between; align-items: center; padding: 0.8rem 1rem; background: var(--bg-elev); border-radius: var(--radius-sm); }
.u-nombre { font-weight: 600; }
.u-rol { font-size: 0.75rem; color: var(--text-dim); margin-left: 0.6rem; text-transform: capitalize; }
.u-rol.dueno { color: var(--accent); }
.u-acciones { display: flex; align-items: center; gap: 0.6rem; }
.u-btn { background: var(--bg-card); border: 1px solid var(--border); color: var(--text); padding: 0.35rem 0.7rem; border-radius: 8px; cursor: pointer; font-size: 0.8rem; }
.u-del { background: none; border: none; color: var(--danger); font-size: 1.3rem; cursor: pointer; }
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: grid; place-items: center; padding: 1rem; z-index: 50; backdrop-filter: blur(4px); }
.modal { padding: 1.8rem; width: 100%; max-width: 400px; max-height: 90vh; overflow-y: auto; }
.modal h3 { font-size: 1.3rem; margin-bottom: 1rem; }
.sel { background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.8rem; color: var(--text); min-height: 50px; width: 100%; }
.qr { display: flex; justify-content: center; margin: 1rem 0; background: #fff; padding: 1rem; border-radius: var(--radius-sm); }
.qr :deep(svg) { width: 200px; height: 200px; }
.secret-txt { font-size: 0.82rem; color: var(--text-dim); text-align: center; margin-bottom: 1rem; }
.secret-txt code { color: var(--accent); word-break: break-all; }
.modal-acciones { display: flex; gap: 0.7rem; margin-top: 0.5rem; }
.modal-acciones .btn { flex: 1; }
</style>