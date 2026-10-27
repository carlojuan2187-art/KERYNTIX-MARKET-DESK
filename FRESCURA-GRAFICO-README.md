# FTrade — corrección de frescura del gráfico

## Cambios
- El gráfico solicita 240 velas en lugar de 300 para acelerar la carga inicial, conservando margen para EMA 200.
- El historial de velas se refresca en segundo plano cada 30 segundos, sin solapar peticiones y sin consultar mientras la pestaña está oculta.
- El indicador distingue `Precio en vivo` (tick WebSocket recibido en los últimos 8 s), `WebSocket lento` (último tick de 8–20 s) y `WebSocket sin datos` (más de 20 s o sin tick).
- El texto aclara que el indicador mide la conexión WebSocket, no la antigüedad del snapshot REST. No se disfraza una conexión rota como en vivo.

## Archivos modificados
- `src/components/Charts.tsx`
- `src/index.css`
- `FRESCURA-GRAFICO-README.md` (nuevo)

## Limitación importante
Esta entrega es solo frontend. Si el estado permanece en `WebSocket sin datos` y el precio/las velas también están realmente atrasados, la causa debe verificarse en el backend/worker: producción de ticks, Redis, ticket `/events/ticket`, canal `/ws/events`, timestamps del proveedor y latencia del endpoint `/market/candles`. El frontend no puede reparar una fuente de mercado que no envía datos.

## Validación
ZIP comprobado por integridad. La compilación completa no se declara validada en este entorno porque no hay dependencias instaladas y el registro npm no estuvo disponible en la ejecución previa. Ejecutar `npm ci`, `npx tsc --noEmit` y `npm run build` en CI antes de desplegar.
