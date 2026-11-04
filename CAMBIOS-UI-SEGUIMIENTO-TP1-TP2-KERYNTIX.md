# KERYNTIX MARKET DESK — textos de seguimiento TP1/TP2

Se actualizaron los textos en español e inglés de la pantalla de señales y resultados para describir el comportamiento vigente:

- Después de TP1, la protección simulada se mueve al precio de entrada.
- Si el precio regresa a la entrada, se registra el resultado TP1 y únicamente `r_tp1`.
- Si continúa hasta TP2, se registra TP2 y únicamente `r_tp2`.
- TP1 y TP2 nunca se suman en una misma operación.

Archivos modificados:

```text
src/assets/guide.json
src/i18n/translation.ts
src/pages/Resultados.tsx
src/pages/Signals.tsx
```

No se modificaron componentes de negocio ni llamadas API del frontend.
