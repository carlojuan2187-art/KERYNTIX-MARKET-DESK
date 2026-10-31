# Contrato de integración FTrade Web

Este cliente consume directamente el contrato HTTP de FastAPI en la raíz del host configurado por `VITE_API_URL` (sin prefijo `/v1`). No hay modo mock en tiempo de ejecución ni fallback a identidades o datos ficticios. Los nombres y estados que se muestran en pantalla se derivan de respuestas reales; los campos nulos se presentan como desconocidos.

## Configuración y transporte

- `VITE_API_URL`: raíz HTTPS del backend en producción.
- `VITE_WS_URL`: WebSocket completo opcional. Si está vacío, el cliente transforma el esquema de la API en WS/WSS y usa `/ws/events`.
- `VITE_TELEGRAM_BOT_USERNAME`: bot público de autenticación; debe coincidir con `TELEGRAM_AUTH_BOT_USERNAME` del backend.
- `VITE_TRIAL_DAYS`: debe coincidir con `TRIAL_DAYS` del backend; solo informa al usuario.
- `VITE_ALERT_DURATION_SECONDS`: duración de los avisos emergentes en el cliente.
- `VITE_SUPPORT_WHATSAPP`: contacto público principal de WhatsApp, en formato internacional sin `+`, espacios ni guiones; se comparte entre Planes, Soporte y avisos de cuenta. `VITE_ADMIN_WHATSAPP_1..3` conserva compatibilidad con contactos adicionales.
- Nunca expongas secretos del servidor mediante variables `VITE_*`.

El cliente envía `credentials: include` para permitir la cookie de sesión `HttpOnly`. El access token se mantiene en memoria. El backend debe permitir el origen web mediante CORS con credenciales y configurar cookies seguras en HTTPS.

## Autenticación y cuenta

| Función de la interfaz | Endpoint |
|---|---|
| Crear desafío de acceso | `POST /auth/phone` |
| Consultar vinculación de Telegram | `GET /auth/telegram-check?token=...` |
| Reenviar código | `POST /auth/resend` |
| Verificar código | `POST /auth/verify` |
| Renovar sesión | `POST /auth/refresh` |
| Cerrar sesión | `POST /auth/logout` |
| Consultar/actualizar perfil | `GET/PATCH /auth/me` |
| Consultar restricción | `GET /account/restriction` |
| Crear/eliminar vínculo de Telegram | `POST/DELETE /account/telegram` |
| Listar/revocar sesiones | `GET /sessions`, `DELETE /sessions/{session_id}` |

La interfaz no puede marcar Telegram como vinculado por sí sola; espera la confirmación del backend.

## Mercado y análisis

| Función | Endpoint |
|---|---|
| Cotizaciones | `GET /market/quotes` |
| Catálogo/búsqueda de símbolos | `GET /symbols?query=...&limit=...` |
| Detalle de símbolo | `GET /symbols/{symbol}` |
| Velas | `GET /market/candles?symbol=...&timeframe=1m|5m|15m|1h|4h|1D&limit=...&tz=...` |
| Régimen de mercado | `GET /market/regime` |
| Derivados | `GET /derivatives?symbol=...` |
| Flujo agresivo | `GET /market/flow?symbol=...` |
| Liquidaciones | `GET /market/liquidations?window=5|15|60` |
| Movers | `GET /market/movers?window=5|15|60` |
| Radar | `GET /radar` |
| Calendario | `GET /calendar?view=7|30` |
| Señales vigentes | `GET /signals?limit=10` |
| Resultados cerrados | `GET /signals/results?limit=100` |
| Detalle de señal | `GET /signals/{symbol}` |
| Resumen de facturación/planes | `GET /billing/plans` |
| Calculadora de posición | `POST /calculator` |

Los campos de mercado pueden ser `null` cuando el proveedor no aporta una lectura. El cliente no los convierte a cero para presentarlos como valores válidos. Liquidaciones y movers pueden responder con estados de recopilación hasta alcanzar cobertura suficiente.

## Preferencias, notificaciones y herramientas personales

| Función | Endpoint |
|---|---|
| Leer watchlist | `GET /watchlist` |
| Añadir símbolo | `POST /watchlist` |
| Quitar símbolo | `DELETE /watchlist/{symbol}` |

`GET /watchlist` devuelve por símbolo las cotizaciones disponibles, tendencia multi-temporal (`trend` 15M/1H/4H), análisis detallado de cada marco (`analyses`: régimen, ADX, DI, EMA20/50/200, ATR%, pendiente EMA50, percentil de volatilidad, volumen relativo y evolución del ancho de bandas), score combinado (`score_detail`), barrido de liquidez (`liquidity_sweep`) y señal activa (`active_signal`). Los campos de mercado o análisis pueden ser `null` si el proveedor no cuenta con datos suficientes.

| Leer preferencias de avisos | `GET /account/alert-preferences` |
| Actualizar preferencias | `PATCH /account/alert-preferences` |
| Crear/listar alertas de precio | `POST/GET /alerts/price` |
| Modificar/eliminar alerta de precio | `PATCH/DELETE /alerts/price/{id}` |
| Consultar notificaciones | `GET /notifications?limit=...` |
| Marcar una/todas como leídas | `POST /notifications/{id}/read`, `POST /notifications/read-all` |
| Crear/listar tickets propios | `POST/GET /support/tickets` |
| Leer ticket o enviar mensaje | `GET /support/tickets/{id}`, `POST /support/tickets/{id}/messages` |

Las preferencias de avisos responden con `{preferences, updated_at}`. Los tickets propios responden con `{items: [...]}` en el listado y con un objeto de ticket al crear/leer. Los cambios se guardan en el backend; no se persisten como sustituto local.

## Pagos y administración

| Función | Endpoint |
|---|---|
| Consultar capacidad/configuración de pago | `GET /billing/plans` |
| Crear/obtener solicitud compatible | `POST /payments/start` |
| Verificar transferencia | `POST /payments/verify` |
| Historial de pagos compatible | `GET /payments/history?limit=...` |
| Resumen administrativo | `GET /admin/stats` |
| Buscar usuarios administrativos | `GET /admin/users` |
| Activar Premium | `POST /admin/users/{user_id}/premium` |
| Bloquear/desbloquear usuario | `PATCH /admin/users/{user_id}/ban`, `PATCH /admin/users/{user_id}/unban` |

El precio, el destino y la red deben proceder del backend. La UI no permite iniciar un pago mientras `payment_configured` no sea `true`; no hay wallet de muestra ni confirmaciones inventadas. Todas las rutas administrativas siguen protegidas en el servidor, independientemente de lo que muestre el cliente.

## Tiempo real

1. El cliente solicita un ticket con `POST /events/ticket` usando la sesión autenticada.
2. Se conecta al `websocket_path` devuelto (normalmente `/ws/events`) con el ticket de un solo uso.
3. Los mensajes válidos se envían al bus UI; los datos persistentes se vuelven a consultar por REST.
4. Los ticks actualizan precio, cambio, volumen y extremos de 24h sin esperar una nueva consulta REST.
5. Si no llega ningún tick de precio al navegador durante 2,5 segundos, la interfaz consulta `/market/quotes` cada 2 segundos como respaldo condicional; una respuesta REST iniciada antes de un tick nuevo no puede sobrescribir la cotización en vivo más reciente.
6. Los eventos `funding.tick` actualizan la tasa de funding por símbolo.

En producción utiliza WSS y comprueba que el backend publique los eventos de mercado, señales, notificaciones y cuenta requeridos.
