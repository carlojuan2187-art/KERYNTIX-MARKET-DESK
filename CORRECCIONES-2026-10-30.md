# Correcciones frontend — 30 de octubre de 2026

## Identidad visual

- Se creó una variante cuadrada independiente del símbolo (toro y gráfico) para los tamaños compactos. Ya no se reutiliza una imagen con el wordmark ampliado y cortado.
- La imagen principal conserva toro, nombre FTRADE y lema, pero elimina la franja inferior de cuatro descripciones que quedaba ilegible al reducir el logo en la navegación.
- `Brand compact` utiliza `object-fit: contain`.
- Favicon, icono de 192 px y Apple Touch Icon apuntan a las nuevas variantes del mismo símbolo.
- La tarjeta social de Open Graph/Twitter se mantiene sin cambios.

## Validación

Se verificaron dimensiones y archivos de imagen con Pillow. La compilación Vite/typecheck no pudo ejecutarse en este entorno: la instalación `npm ci` quedó bloqueada al descargar paquetes desde npm y el paquete `yallist@3.1.1` no estaba en caché (`ENOTCACHED`). Ejecutar `npm ci`, `npm run build` y Playwright en CI/Railway antes de publicar en producción.
