# Arquitectura de BRASA

## Componentes

```
Navegador (Angular PWA)  ──HTTP/JSON──▶  API NestJS (/api)  ──Prisma──▶  SQLite
        ▲                                     │
        └──────────── SSE (fetch) ◀───────────┘  EventosService (bus en memoria)
                                              │
                                              └──▶ Wompi (checkout, consulta, webhook)
```

## Backend (`server/src`)

| Módulo | Responsabilidad |
|---|---|
| `config/` | Lee y valida variables de entorno; la API no arranca con valores inseguros |
| `common/` | Prisma, auditoría, bus de eventos SSE, utilidades criptográficas, valores del dominio |
| `auth/` | Registro, login, recuperación de contraseña, perfil, gestión de usuarios (ADMIN), guards globales |
| `catalogo/` | Productos y categorías (lectura pública, edición ADMIN, "agotado" para cocina/mesero) |
| `mesas/` | Mesas, códigos QR (generados en el servidor), resolución pública del código |
| `pedidos/` | Cálculo de precios (`precios.ts`), máquina de estados (`transiciones.ts`), pedidos, SSE |
| `solicitudes/` | Llamados al mesero (sin duplicados mientras haya uno pendiente) |
| `pagos/` | Proveedores (`proveedores.ts`: Wompi y simulado), idempotencia, efectivo, reembolsos |
| `calificaciones/` | 1–5 estrellas, solo pedidos entregados, una por pedido |
| `reportes/` | Ventas cobradas, ticket promedio, más vendidos, calificación promedio |

### Seguridad (referencia OWASP ASVS 5.0)

- **Autenticación (V6):** bcrypt costo 12, contraseña mínima de 10 caracteres sin reglas de composición,
  mensajes genéricos (sin enumerar cuentas), recuperación con token aleatorio de 256 bits guardado como
  hash, de un solo uso y con 30 minutos de vigencia.
- **Sesiones (V7):** JWT HS256 de 2 h. Cada usuario tiene `versionSesion`: cambiar contraseña, rol o
  desactivarlo invalida de inmediato los tokens emitidos antes.
- **Autorización (V8):** guard global (todo exige sesión salvo `@Publico()`) + `@Roles()`. El acceso a un
  pedido exige ser personal, el cliente dueño o presentar el token de seguimiento; si no, se responde 404
  (sin revelar que existe).
- **Validación (V2):** DTOs con class-validator, `whitelist` y `forbidNonWhitelisted` (campos extra = 400).
  Los precios nunca se aceptan del cliente.
- **Lógica de negocio:** transiciones de estado condicionadas al estado actual (sin condiciones de carrera),
  cupones con límite de usos dentro de una transacción.
- **Pagos:** firma de integridad en el checkout, verificación de la firma de los eventos de Wompi en tiempo
  constante, clave de idempotencia única por evento, validación de monto y moneda, referencia impredecible.
- **Configuración (V13):** helmet, CORS restringido a `FRONTEND_URL`, límite de 100 kB por petición, rate
  limiting general (120/min) y estricto en login/registro/recuperación (5/min).
- **Registro (V16):** tabla `RegistroAuditoria` para inicios de sesión, fallos, cambios de estado, pagos y
  acciones administrativas (sin secretos).
- **Datos personales (Ley 1581):** autorización explícita al registrarse y al pedir factura; los datos de
  facturación solo los ve el administrador.

## Base de datos

Ver `server/prisma/schema.prisma`. Puntos clave de integridad:

- `PRAGMA foreign_keys = ON` en cada conexión (SQLite no lo activa por defecto).
- Únicos: correo de usuario, número y código de mesa, número de pedido, referencia de pago,
  id de transacción del proveedor, clave de idempotencia de eventos de pago, una calificación por pedido.
- Los productos no se borran (se marcan agotados) y los ítems del pedido guardan nombre y precio del
  momento de la compra.
- Índices por estado, fecha, cliente, mesa y pedido.

## Frontend (`src/app`)

- `core/services`: API, sesión, carrito (estimación local + cotización del servidor), pedidos (seguimiento
  por SSE), panel del personal, mesa (código QR), solicitudes, calificaciones.
- `core/auth`: interceptor (agrega el token solo a la API propia) y guard por rol (solo navegación: la
  autorización real está en el servidor).
- `features`: inicio, entrada por QR, menú, carrito, seguimiento, pago, resultado de pago y simulador,
  historial, autenticación, cocina, meseros, administración.

## Máquina de estados del pedido

```
PENDIENTE ──(mesero/cocina)──▶ CONFIRMADO ──(cocina)──▶ EN_PREPARACION ──(cocina)──▶ LISTO ──(mesero)──▶ ENTREGADO
    │                               │
    └──(cliente, mesero, admin)─────┴──(mesero, admin)──▶ CANCELADO
```

Cancelar un pedido con pagos aprobados solo lo puede hacer un administrador, y esos pagos quedan en
`REEMBOLSO_SOLICITADO`.
