# FTrade — cambios de derivados y notificaciones (2026-10-31)

## Derivados
- Se retiró de la vista web el panel «Top traders» (cuentas y posiciones), que dependía de endpoints autenticados de Binance.
- Se eliminó de la vista web la referencia a `BINANCE_API_KEY` para ese panel.
- La sección de posicionamiento global de cuentas se conserva y ocupa el ancho disponible.
- El histórico de funding diferencia una serie válida de una lectura aislada: con un único punto muestra el último valor y su hora, sin fingir que existe una curva histórica.
- El histórico de base grafica `basis_rate_pct` (base por período) aunque Binance no entregue `annualizedBasisRate`. La base anualizada queda separada y no se estima artificialmente.
- Los mensajes de ausencia de datos distinguen funding/base y no los confunden con liquidaciones.
- Se retiraron las filas de Top Traders de los detalles de derivados en Watchlist.

## Notificaciones
- Se añadió «Nuevas señales» a las preferencias de avisos.
- La pantalla permite activar/desactivar esta categoría con los controles de notificaciones existentes.

## Validación
- Sintaxis de `Derivados.tsx`, `AjustesAvisos.tsx`, `Watchlist.tsx` y `types.ts` comprobada con el compilador TypeScript en modo transpile.
- No se pudo certificar `vite build` en este entorno porque no se instalaron las dependencias de frontend.
