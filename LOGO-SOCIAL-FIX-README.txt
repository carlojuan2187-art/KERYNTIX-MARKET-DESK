FTRADE — CORRECCIÓN DEL LOGO Y VISTA PREVIA SOCIAL

Cambios:
- El logo principal ahora se importa desde src/assets para que Vite lo empaquete con el frontend y no dependa de una ruta absoluta a public.
- El icono compacto también se importa desde src/assets.
- public/ftrade-social.jpg contiene el logo exacto ajustado a 1200x630 sin recortar el diseño.
- index.html conserva Open Graph/Twitter Card y añade ?v=2 para ayudar a invalidar caché antigua del scraper.

Para desplegar:
1. Sustituye el contenido del frontend por FTrade-Web-main de este ZIP (no subas el ZIP anidado como un archivo dentro del repositorio).
2. Ejecuta un nuevo build/deploy en Railway.
3. Comprueba públicamente https://ftrade-web-production.up.railway.app/ftrade-social.jpg?v=2 y https://ftrade-web-production.up.railway.app/ftrade-icon.png.
4. En WhatsApp, pega el enlace completo en un chat de prueba. La vista previa depende de que el servidor devuelva el index.html con metadatos y la imagen sea accesible sin iniciar sesión.
