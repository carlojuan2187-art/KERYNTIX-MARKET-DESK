# FTrade Web — cliente conectado al backend

Interfaz React + TypeScript + Vite para FTrade. Esta versión es **API-only**: no incorpora sesiones de ejemplo, cotizaciones de muestra, resultados ficticios, pagos simulados ni un modo `mock`. Las vistas consumen la API FastAPI configurada y muestran errores o estados de recopilación cuando el servicio no tiene datos.

El front-end requiere el repositorio backend desplegado o ejecutándose localmente. Que el front-end compile no significa que Binance, Telegram, MongoDB, Redis, la verificación de pagos o el WebSocket estén configurados en el servidor.

## Requisitos

- Node.js 22 (versión utilizada por CI).
- npm.
- Backend FastAPI de FTrade accesible desde el navegador.
- Un bot de Telegram dedicado a la autenticación, configurado tanto en el backend como en `VITE_TELEGRAM_BOT_USERNAME`.

## Configuración local

```bash
npm ci
cp .env.example .env.local
```

Edita `.env.local`:

- `VITE_API_URL`: URL raíz del backend, sin `/v1` al final. Para desarrollo suele ser `http://localhost:8000`; en producción, el host HTTPS público.
- `VITE_WS_URL`: endpoint WebSocket completo. Si se deja vacío, la aplicación deriva `ws://`/`wss://` desde `VITE_API_URL` y usa `/ws/events`.
- `VITE_TELEGRAM_BOT_USERNAME`: usuario del bot de autenticación, sin `@`; debe coincidir con `TELEGRAM_AUTH_BOT_USERNAME` en el backend.
- `VITE_TRIAL_DAYS`: debe coincidir con `TRIAL_DAYS` en el backend. Es información visible, no controla la duración real de la prueba.
- `VITE_ALERT_DURATION_SECONDS`: duración visual de los avisos emergentes.
- `VITE_ADMIN_WHATSAPP_1..3`: teléfonos públicos de soporte opcionales.
- `VITE_APP_DOMAIN`: host opcional para enlaces públicos; si está vacío se usa el host actual.

No pongas tokens privados, claves de API, secretos de Telegram, credenciales de base de datos, claves RPC ni claves de firma en variables `VITE_*`: Vite las incorpora al código que recibe el navegador. Los secretos pertenecen únicamente al entorno del backend.

Inicia el cliente:

```bash
npm run dev
```

## Compilación y validación

```bash
npx tsc --noEmit
npm run build
npm run test:e2e
```

La CI de GitHub ejecuta el type-check y el build en Node 22, además de la suite E2E del front-end. Las pruebas E2E aíslan llamadas HTTP con respuestas controladas; eso es solo el entorno de prueba y no agrega un modo simulado al producto publicado.

## Integración real

- **Autenticación:** el navegador crea el desafío por teléfono, espera la verificación del contacto en el bot y valida el código con el backend. El access token vive en memoria y la cookie de renovación es `HttpOnly`.
- **Mercado y análisis:** cotizaciones, símbolos, velas, régimen, derivados, flujo, liquidaciones, movers, radar, calendario y resultados vienen de endpoints reales del backend.
- **Tiempo real:** se solicita un ticket de un solo uso a `POST /events/ticket` y se conecta a `/ws/events`. La aplicación conserva refresco REST como respaldo.
- **Cuenta y preferencias:** watchlist, sesiones, perfil, alertas, notificaciones y soporte se guardan mediante endpoints del backend.
- **Pagos:** el precio y los detalles del plan se leen de `GET /billing/plans`. El botón de pago permanece deshabilitado si el backend no anuncia `payment_configured: true`. No envíes fondos hasta haber verificado la configuración real del servidor.
- **Datos incompletos:** las métricas no disponibles se presentan como `—`; el front-end no rellena cotizaciones, porcentajes ni cierres con ejemplos.

## Despliegue

Sirve el contenido generado en `dist/` desde el alojamiento web elegido. Configura el backend para permitir el origen del front-end mediante CORS con credenciales cuando corresponda y usa HTTPS/WSS en producción. El backend debe disponer de sus propios secretos, almacenamiento, conectores de mercado, bot de Telegram y verificador de pagos. Comprueba el flujo autenticado completo en un entorno privado antes de abrir el servicio al público.

## Estructura

- `src/api/`: cliente HTTP, autenticación y adaptadores para los endpoints del backend.
- `src/context/`: estado de sesión, notificaciones y conexión WebSocket.
- `src/pages/`: pantallas de la aplicación.
- `API_CONTRACT.md`: endpoints y correspondencia de integración.
