# NexusStore Frontend — Capa 1: Cimientos

Esta capa te da: cliente de API, autenticación (login/registro), router
protegido y dashboard. Al terminar, podés registrarte/entrar y ver tu inicio.

---

## 1. Dónde va cada archivo (dentro de `nexusstore-frontend`)

| Archivo | Destino |
|---|---|
| `api.ts` | `src/services/api.ts` (crear carpeta `services`) |
| `auth.ts` | `src/stores/auth.ts` (REEMPLAZA el counter.ts de ejemplo, o agregalo) |
| `index.ts` (router) | `src/router/index.ts` (REEMPLAZA el existente) |
| `main.css` | `src/assets/main.css` (REEMPLAZA el existente) |
| `main.ts` | `src/main.ts` (REEMPLAZA el existente) |
| `App.vue` | `src/App.vue` (REEMPLAZA el existente) |
| `LoginView.vue` | `src/views/LoginView.vue` |
| `RegistroView.vue` | `src/views/RegistroView.vue` |
| `DashboardView.vue` | `src/views/DashboardView.vue` |
| `PosView.vue` | `src/views/PosView.vue` (placeholder temporal) |
| `FiadosView.vue` | `src/views/FiadosView.vue` (placeholder temporal) |
| `CajaView.vue` | `src/views/CajaView.vue` (placeholder temporal) |
| `ProductosView.vue` | `src/views/ProductosView.vue` (placeholder temporal) |
| `ReportesView.vue` | `src/views/ReportesView.vue` (placeholder temporal) |
| `.env.example` | raíz del proyecto (copialo también como `.env`) |

### Archivos de ejemplo que podés BORRAR
El scaffold de Vue creó componentes y vistas de ejemplo que no usamos:
- `src/components/` (HelloWorld.vue, TheWelcome.vue, WelcomeItem.vue, icons/)
- `src/views/HomeView.vue` y `src/views/AboutView.vue`
- `src/stores/counter.ts`
Borralos para mantener el proyecto limpio (opcional pero recomendado).

---

## 2. Crear el archivo .env

En la raíz de `nexusstore-frontend`, creá un archivo `.env` con:

```
VITE_API_URL=http://localhost:8000/api
```

Esto le dice al frontend dónde está tu backend Laravel.

---

## 3. Verificar el alias @

El símbolo `@` apunta a `src/`. El scaffold de Vue ya lo configura en
`vite.config.ts`. Si por algo no funciona, confirmá que `vite.config.ts`
tenga algo como:

```ts
resolve: {
  alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
}
```

---

## 4. Arrancar y probar

Con el BACKEND corriendo (`php artisan serve` en la otra carpeta):

```powershell
cd C:\Users\braxf\nexusstore-frontend
npm run dev
```

Abrí http://localhost:5173

### Prueba completa
1. Te debe mandar a /login (porque no hay sesión).
2. Clic en "Creá tu tienda" → llená el formulario → "Crear mi tienda".
3. Debe registrarte, guardar el token y llevarte al POS (placeholder por ahora).
4. Volvé al inicio: el dashboard debe mostrar tu nombre, el de la tienda,
   y las métricas (en cero si es nuevo).
5. Cerrá sesión con "Salir" y volvé a entrar con login para confirmar.

Si el login/registro conecta y ves el dashboard con tus datos reales
traídos del backend, la capa 1 está lista.

---

## Solución de problemas

- **"Network Error" o CORS**: el backend Laravel debe permitir el origen
  del frontend. Laravel 10 trae CORS configurado para `/api/*` por defecto
  en `config/cors.php` (allowed_origins = ['*'] en desarrollo). Si te da
  problema, confirmá que ahí esté permitido http://localhost:5173.
- **El token no persiste**: revisá que el navegador permita localStorage.
- **404 en las rutas de la API**: confirmá que el backend corra en el
  puerto 8000 y que `php artisan route:list` muestre las rutas.
