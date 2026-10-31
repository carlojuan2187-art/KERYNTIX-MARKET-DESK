# Fase 2 — Web Push, canales y seguridad (2026-10-31)

## Web Push en navegador
- `public/sw.js` muestra notificaciones push con la web cerrada y abre únicamente rutas del mismo origen al pulsarlas.
- `src/api/webPush.ts` registra y elimina la suscripción actual con el backend.
- Ajustes permite activar/desactivar Centro FTrade, Telegram y navegador/dispositivo por separado.
- El backend incorpora `DELETE /push/subscriptions/current`, idempotente y limitado a la suscripción del usuario autenticado.

## Preferencias
- `in_app` controla el inbox/toasts de FTrade.
- `telegram` controla la entrega al chat vinculado.
- `web_push` controla la notificación de sistema/Web Push.
- Los filtros de eventos y el interruptor general se siguen respetando.

## Sesiones
- Se puede activar cookie-only con `AUTH_REFRESH_IN_BODY=false` y `VITE_AUTH_COOKIE_ONLY=true`.
- No activar el modo cookie-only hasta verificar que frontend y API comparten un site y que la cookie HttpOnly se envía de forma consistente en los navegadores objetivo.
- `AUTH_COOKIE_SAMESITE=lax` se recomienda para front/API en el mismo site; conservar `none` si están realmente en sitios diferentes.
- Por compatibilidad, el fallback en body/localStorage permanece habilitado por defecto.

## Variables backend Web Push
Configurar en API y worker con el mismo juego de claves: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY_PATH` o `VAPID_PRIVATE_KEY_PEM`/`VAPID_PRIVATE_KEY_PEM_B64`, y `VAPID_SUBJECT`. No colocar la clave privada en variables `VITE_*`.

## Seguridad API
Se añaden `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` y HSTS en producción.

## Ajustes finales de esta entrega
- El canal Web Push mantiene su preferencia a nivel de cuenta y permite registrar cada navegador por separado cuando esa preferencia ya estaba activa.
- Las notificaciones del sistema se muestran exclusivamente desde el Service Worker; la pestaña abierta no crea una segunda `Notification`, evitando avisos duplicados.
- El Service Worker usa `skipWaiting`/`clients.claim` y se registra con `updateViaCache: none` para actualizar el manejador de notificaciones.
- En modo cookie-only, cualquier refresh token residual de `localStorage` se elimina al intentar restaurar la sesión.
