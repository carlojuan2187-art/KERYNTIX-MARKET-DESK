## Actualización — gráfico interactivo adaptable (26 de octubre de 2026)

- El gráfico permite zoom horizontal con la rueda, zoom por pellizco en dispositivos táctiles y desplazamiento por arrastre; también se puede recorrer el historial con Shift+rueda o la rueda horizontal.
- La escala de precios derecha permite zoom vertical con arrastre y desplazar la escala con Shift+arrastre; los botones +/− y el control inferior permiten cambiar o restablecer el zoom.
- Se añadió una agarradera para ajustar la altura del gráfico entre 220 y 720 píxeles, con soporte de teclado.
- La navegación tiene acceso a hasta 300 velas, manteniendo el cálculo previo de indicadores; el gráfico enseña inicialmente las 60 más recientes y permite desplazarse por el historial sin cambiar de temporalidad.
- Al recorrer velas antiguas, la línea de precio en vivo deja de forzar la escala y no aplasta la vista histórica.

# Estado de entrega del front-end FTrade

## Actualización — gráfico de mercado y herramientas técnicas (26 de octubre de 2026)

- El gráfico conserva la fuente de velas OHLC de Binance Futures, pero sigue el precio vivo del contexto de cotizaciones; actualiza la vela abierta con el tick más reciente y dibuja una línea de referencia exacta cuando la vela histórica ya está cerrada.
- Se añadieron las temporalidades `1m` y `5m` a la interfaz y al contrato de la API. La carga obtiene hasta 300 velas para dar período de calentamiento a EMA 200; el gráfico interactivo muestra inicialmente las 60 más recientes y permite recorrer el resto del historial.
- Se añadieron controles para EMA 9/21/50/200, VWAP de las velas cargadas, Bandas de Bollinger, volumen, RSI 14, MACD 12/26/9 y ATR 14.
- Se añadió una calculadora de escenarios LONG/SHORT que estima cantidad, exposición, margen y riesgo/beneficio, marca entrada, stop y objetivo en el gráfico, y no envía órdenes reales.
- La interfaz advierte que VWAP se calcula sobre las velas cargadas y que los indicadores no garantizan resultados.

## Cambios aplicados

- Eliminados el usuario premium/admin de demostración, el acceso simulado por Telegram, el código fijo de verificación, las capas `mockData`/`simulation` y el modo de autenticación `mock`.
- Los módulos de la interfaz usan adaptadores HTTP para el backend FTrade; los campos ausentes se mantienen como desconocidos en vez de convertirse en cifras inventadas.
- Añadida la conexión WebSocket mediante ticket autenticado en `/events/ticket` y `/ws/events`, con reintentos y refresco REST de respaldo.
- Corregido el manejo de preferencias de avisos, estados de pago, la dirección de liquidaciones, el progreso de confirmación y lecturas desconocidas de radar/flujo/derivados.
- Corregido el fallo de renderizado de “Mi Plan” cuando `VITE_ADMIN_WHATSAPP_1` no está configurado: el contacto es opcional y la página muestra un aviso en su lugar. También se protege el enlace equivalente del aviso de cuenta bloqueada.
- Añadida una prueba Playwright de regresión para verificar que “Mi Plan” se renderiza con el contacto de WhatsApp vacío.
- Actualizadas las instrucciones de configuración, el contrato del front-end y las pruebas para que no esperen un modo de demostración.
- La CI de GitHub valida tipos, build y pruebas Playwright al subir cambios.

## Verificación realizada en esta copia

- Auditoría sintáctica: 40 archivos TypeScript/TSX y configuración, 0 errores de parser y 0 imports locales sin resolver. Se transpilaron los archivos fuente no declarativos sin errores sintácticos. La compilación completa de Vite, el chequeo semántico y Playwright no se pudieron ejecutar porque `npm ci` agotó el tiempo intentando descargar dependencias y la caché offline no contenía `yallist@3.1.1`.
- Auditoría de imports locales: 0 rutas locales sin resolver.
- `npm ci` no pudo completarse en este entorno: el intento offline no tenía `yallist@3.1.1` en caché y el intento normal agotó el tiempo disponible. Por tanto, **no afirmo que se hayan ejecutado con éxito** el chequeo semántico `tsc --noEmit`, el build de Vite ni Playwright localmente.
- La CI configurada ejecutará esos tres controles en GitHub con las dependencias del `package-lock.json`.
- No se ha desplegado el backend desde aquí. Antes de publicar, hay que validar las credenciales, CORS/cookies, WebSocket, Telegram y la configuración de pagos en un entorno privado.

## Configuración antes del despliegue

1. Definir `VITE_API_URL`, `VITE_WS_URL` y el nombre real del bot de autenticación en el entorno del hosting.
2. Alinear `VITE_TRIAL_DAYS` con `TRIAL_DAYS` del backend y revisar los contactos públicos de soporte.
3. Confirmar que el backend tiene conectados sus proveedores de datos y que `GET /billing/plans` devuelve `payment_configured: true` solo cuando la verificación de pagos está operativa.
4. Esperar a que la CI finalice y probar el flujo autenticado completo en staging antes de abrir el servicio al público.

**Conclusión:** el código fuente se puede subir al repositorio como candidato API-only; la compilación y el despliegue final permanecen pendientes de CI y staging, no de una simulación del cliente.
