# Pendientes conocidos

Prioridad: **A** alta · **M** media · **B** baja.

| # | Prioridad | Pendiente | Motivo |
|---|---|---|---|
| 1 | A | Transporte de correo real (SMTP o proveedor) para la recuperación de contraseña | Hoy el enlace solo se escribe en la consola del servidor en desarrollo; en producción no se envía |
| 2 | A | Emisión de la factura electrónica ante la DIAN | Requiere un proveedor tecnológico autorizado y credenciales; hoy se capturan y guardan los datos con autorización |
| 3 | A | Probar el flujo con llaves de **sandbox** de Wompi y el webhook expuesto públicamente | Requiere credenciales del comercio; el código está cubierto con pruebas unitarias de firmas |
| 4 | A | Confirmar el impuesto aplicable (IVA 19 % vs. INC 8 %) | Decisión contable; configurable con `IMPUESTO_PORCENTAJE` |
| 5 | M | Reembolsos automáticos vía API de Wompi | Hoy el reembolso se marca en BRASA y se ejecuta en el panel de Wompi |
| 6 | M | Vista "por mesa" para meseros (mesas ocupadas, cuenta acumulada) | El mesero ve pedidos con su número de mesa, pero no un mapa de mesas |
| 7 | M | Varias instancias del backend | El bus de tiempo real (SSE) está en memoria: hoy debe correr un solo proceso de Gunicorn. Para escalar: Redis o LISTEN/NOTIFY de PostgreSQL |
| 8 | M | Pruebas end-to-end automatizadas del navegador (Playwright) | Los flujos se probaron manualmente en navegador; hay pruebas de API e unitarias |
| 10 | B | Eliminar `src/app/core/services/historial-pedidos.service.ts` | Quedó sin uso (el historial viene del servidor); se conserva hasta que se autorice borrarlo |
| 11 | B | Política de privacidad publicada y texto legal completo de tratamiento de datos | Las casillas de autorización existen; falta el documento enlazado |
| 12 | B | Revisar los iconos PWA y agregar capturas al manifiesto | No se verificó que los iconos actuales correspondan a la marca |
| 13 | B | Paginación/filtros adicionales en historial de pagos y calificaciones | Hoy se muestran los 50 más recientes |

## Resueltos recientemente

- Keycloak: inicio de sesión único del personal (ADMIN, MESERO, COCINA).
- Pipeline de GitLab CI/CD ejecutado en GitLab.com: pruebas del backend (PostgreSQL), pruebas y build del frontend en verde.
