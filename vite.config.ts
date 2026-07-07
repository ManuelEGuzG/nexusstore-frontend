import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    basicSsl(), // Habilita la generación automática del certificado SSL local
  ],
  server: {
    host: true, // Permite que el servidor escuche en la IP de tu red local (192.168.x.x)
    port: 5173, // Mantiene el puerto estándar que ya estabas usando
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
