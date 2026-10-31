# FTrade — Flujo de inicio de sesión y registro

## Comportamiento de la interfaz

- **Iniciar sesión:** teléfono internacional + contraseña; utiliza `POST /auth/login` y no inicia ningún flujo de Telegram.
- **Crear cuenta:** teléfono internacional + contraseña y confirmación; utiliza `POST /auth/register`. Solo se crea la cuenta después de vincular/verificar el contacto por Telegram y validar el código con `POST /auth/verify`.
- **Recuperar/configurar acceso:** `POST /auth/recover`, verificación mediante Telegram y `POST /auth/password` para guardar la nueva contraseña.
- Los usuarios autenticados se redirigen al terminal desde `/login`.

## Selector de países

`src/api/countries.ts` contiene 250 países y territorios con nombre en español, bandera y prefijo telefónico. Puerto Rico, República Dominicana y Estados Unidos usan `+1`; para esos países el usuario incluye el código de área en el número nacional (por ejemplo, 787 o 809).

## Cuentas anteriores

Las cuentas creadas antes de incorporar contraseñas no tienen una contraseña que pueda recuperarse de forma segura. Deben configurar una sola vez su contraseña mediante **¿Olvidaste tu contraseña o tienes una cuenta anterior? Configurar acceso con Telegram**. Después entrarán directamente con teléfono y contraseña.

## Configuración necesaria

Para crear cuentas y recuperar contraseñas, el frontend necesita `VITE_TELEGRAM_BOT_USERNAME` y el backend debe tener configurado el bot de Telegram. El login ordinario con contraseña no depende del bot.
