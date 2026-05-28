import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { publica: true },
    },
    {
      path: '/registro',
      name: 'registro',
      component: () => import('@/views/RegistroView.vue'),
      meta: { publica: true },
    },
    {
      path: '/',
      name: 'inicio',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/pos',
      name: 'pos',
      component: () => import('@/views/PosView.vue'),
    },
    {
      path: '/fiados',
      name: 'fiados',
      component: () => import('@/views/FiadosView.vue'),
    },
    
    {
      path: '/productos',
      name: 'productos',
      component: () => import('@/views/ProductosView.vue'),
    },
    {
      path: '/reportes',
      name: 'reportes',
      component: () => import('@/views/ReportesView.vue'),
    },
     {
      path: '/historial',
      name: 'historial',
      component: () => import('@/views/HistorialView.vue'),
    },
    {
      path: '/configuracion',
      name: 'configuracion',
      component: () => import('@/views/ConfiguracionView.vue'),
    },
  ],
})

// Guard de navegación: protege todo lo que no sea público.
router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta.publica && !auth.estaAutenticado) {
    return { name: 'login' }
  }
  // Si ya está logueado y va a login/registro, mándalo al inicio.
  if (to.meta.publica && auth.estaAutenticado) {
    return { name: 'inicio' }
  }
})

export default router
