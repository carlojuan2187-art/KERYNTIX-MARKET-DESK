# Planes y contacto por WhatsApp — 2026-10-31

## Cambios

- El precio base Premium usa `numberTrimmed(..., 3)`: muestra `10` en lugar de `10.000`, y conserva hasta tres decimales significativos cuando el precio realmente los tiene.
- El importe exacto de una solicitud de pago no se modifica; solo cambia la presentación del precio base del plan.
- Se incorpora `VITE_SUPPORT_WHATSAPP` como contacto público principal compartido entre Planes, Soporte y avisos de cuenta.
- Se mantienen `VITE_ADMIN_WHATSAPP_1..3` como compatibilidad para contactos adicionales y despliegues existentes.
- Los números se normalizan a dígitos internacionales, se descartan formatos inválidos y se eliminan duplicados.
- Soporte muestra el estado de contacto no configurado cuando no hay ningún teléfono válido.

## Configuración necesaria en Railway

En el servicio **Frontend / FTrade Web**, añade la variable pública de build:

`VITE_SUPPORT_WHATSAPP=CODIGO_PAIS_NUMERO`

Usa el número oficial con código de país, solo dígitos (sin `+`, espacios, guiones ni paréntesis). Ejemplo de formato, no un número real: `1XXXXXXXXXX`.

Después guarda los cambios y despliega/reconstruye el frontend. Las variables `VITE_*` se incorporan al bundle durante el build, por lo que añadir la variable sin reconstruir no actualiza los enlaces publicados.

No se utiliza `ADMIN_PHONE_NUMBERS` del backend como contacto público: esa variable sirve para autorización de administradores y no debe exponerse automáticamente como teléfono de soporte.

## Validación

- Prueba de regresión de Planes con precio API `10.000`, verificando que el precio mostrado no conserve los ceros finales.
- Validación estática de los cambios TS/TSX.
- La activación del enlace de WhatsApp en producción queda pendiente de configurar el número público real en Railway.
