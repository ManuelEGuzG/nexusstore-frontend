// vue3-apexcharts no incluye sus propios tipos de TypeScript.
// Esta declaración evita el error "Cannot find module 'vue3-apexcharts'"
// al compilar (npm run build) o al correr el chequeo de tipos (vue-tsc).
declare module 'vue3-apexcharts' {
  import type { DefineComponent } from 'vue'
  const VueApexCharts: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default VueApexCharts
}
