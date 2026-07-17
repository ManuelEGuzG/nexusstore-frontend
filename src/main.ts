import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'

import App from './App.vue'
import router from './router'
import { iniciarAutoSync } from '@/services/sync'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.component('apexchart', VueApexCharts)

app.mount('#app')

// Arranca la sincronización automática de ventas offline.
// Reintenta cuando vuelve la conexión y cada 30 segundos.
iniciarAutoSync()
