import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

interface User {
  id: number
  nombre: string
  correo: string
  rol: string
  store_id: number
}

interface Store {
  id: number
  nombre: string
  moneda: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const store = ref<Store | null>(null)
  const token = ref<string | null>(localStorage.getItem('nexus_token'))

  const estaAutenticado = computed(() => !!token.value)
  const esDueno = computed(() => user.value?.rol === 'dueño')

  function guardarSesion(data: { token: string; user: User; store: Store }) {
    token.value = data.token
    user.value = data.user
    store.value = data.store
    localStorage.setItem('nexus_token', data.token)
  }

  async function registrar(payload: {
    nombre: string
    correo: string
    password: string
    tienda_nombre: string
    moneda?: string
  }) {
    const { data } = await api.post('/register', payload)
    guardarSesion(data)
    return data
  }

  async function login(correo: string, password: string) {
    const { data } = await api.post('/login', { correo, password })
    guardarSesion(data)
    return data
  }

  async function cargarUsuario() {
    if (!token.value) return
    try {
      const { data } = await api.get('/me')
      user.value = data.user
      store.value = data.store
    } catch {
      cerrarSesion()
    }
  }

  async function cerrarSesion() {
    try {
      if (token.value) await api.post('/logout')
    } catch {
      // ignoramos errores de logout
    }
    token.value = null
    user.value = null
    store.value = null
    localStorage.removeItem('nexus_token')
  }

  return {
    user,
    store,
    token,
    estaAutenticado,
    esDueno,
    registrar,
    login,
    cargarUsuario,
    cerrarSesion,
  }
})
