# Planes y contacto por WhatsApp — 2026-10-31

## Cambios

- El precio base Premium usa `numberTrimmed(..., 3)`: muestra `10` en lugar de `10.000`, y conserva hasta tres decimales significativos cuando el precio realmente los tiene.
- El importe exacto de una solicitud de pago no se modifica; solo cambia la presentación del precio base del plan.
- Se incorpora `VITE_SUPPORT_WHATSAPP` como contacto público principal compartido entre Planes, Soporte y avisos de cuenta.
- Se configura el número oficial proporcionado por el propietario: `+5359494299` (para `wa.me`, `5359494299`). También queda como fallback en el frontend si la variable de Railway no está definida.
- Se mantienen `VITE_ADMIN_WHATSAPP_1..3` como compatibilidad para contactos adicionales y despliegues existentes.
- Los números se normalizan a dígitos internacionales, se descartan formatos inválidos y se eliminan duplicados.
- Soporte muestra el estado de contacto no configurado cuando no hay ningún teléfono válido.

## Configuración necesaria en Railway

En el servicio **Frontend / KERYNTIX MARKET DESK Web**, añade la variable pública de build:

`VITE_SUPPORT_WHATSAPP=5359494299`

El valor actual es el número oficial confirmado: `5359494299` (Cuba, prefijo `+53`). Déjalo en ese formato, solo dígitos, sin `+`, espacios, guiones ni paréntesis.

Después guarda los cambios y despliega/reconstruye el frontend. Las variables `VITE_*` se incorporan al bundle durante el build, por lo que añadir la variable sin reconstruir no actualiza los enlaces publicados.

No se utiliza `ADMIN_PHONE_NUMBERS` del backend como contacto público: esa variable sirve para autorización de administradores y no debe exponerse automáticamente como teléfono de soporte.

## Validación

- Prueba de regresión de Planes con precio API `10.000`, verificando que el precio mostrado no conserve los ceros finales.
- Validación estática de los cambios TS/TSX.
- El enlace usa el número confirmado. Para que el valor de despliegue quede explícito y sustituible desde Railway, configura también `VITE_SUPPORT_WHATSAPP=5359494299` en el servicio frontend y reconstruye el frontend. Si no se define la variable, el fallback integrado mantiene activo el contacto oficial.
