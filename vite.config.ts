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
    proxy: {
      // El frontend corre en HTTPS (por la cámara del escáner). Si el celular
      // le pidiera datos directo a Laravel en HTTP, el navegador bloquearía
      // la petición por "contenido mixto". Este proxy hace que el celular
      // solo hable con el origen HTTPS de Vite; Vite reenvía internamente
      // (en la propia PC) al backend Laravel en HTTP. Sin esto, el POS no
      // va a poder cargar productos ni guardar ventas desde el celular.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
