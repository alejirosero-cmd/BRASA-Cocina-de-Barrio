# Arquitectura de BRASA

## Componentes

```
                    ┌──────────────── Docker Compose ─────────────────┐
Navegador  ──HTTP──▶│ Nginx (frontend)  ──/api──▶  Django + Gunicorn  │──▶ PostgreSQL 17
(Angular PWA)  ◀SSE─│  web compilada               (backend)          │
                    └──────────────────────────────────┬──────────────┘
                                                       └──▶ Wompi (checkout, consulta, webhook)
```

En desarrollo local, Angular corre con `ng serve` (puerto 4200), Django con `runserver` (puerto 8000) y la
base de datos es SQLite.

## Backend (`backend/`, Django 6.1 + Django REST Framework)

| App | Responsabilidad |
|---|---|
| `config/` | Configuración; `entorno.py` valida las variables y la API no arranca con valores inseguros |
| `nucleo/` | JWT, permisos por rol, límites de peticiones, errores, bus SSE, auditoría, comandos (`sembrar`, `importar_anterior`, `cambiar_clave`) |
| `cuentas/` | Usuarios, registro, login, recuperación y cambio de contraseña, gestión de usuarios (ADMIN) |
| `catalogo/` | Productos y categorías (lectura pública, edición ADMIN, "agotado" para cocina y mesero) |
| `mesas/` | Mesas y códigos QR (SVG generado en el servidor) |
| `pedidos/` | Precios (`precios.py`, funciones puras), máquina de estados, pedidos, cupones, tiempo real |
| `solicitudes/` | Llamados al mesero (sin duplicados mientras haya uno pendiente) |
| `pagos/` | Proveedores Wompi y simulado (`proveedores.py`), idempotencia, efectivo, reembolsos |
| `calificaciones/` | 1–5 estrellas, solo pedidos entregados, una por pedido |
| `reportes/` | Ventas cobradas, ticket promedio, más vendidos, calificación promedio |

Las vistas son `APIView` de DRF y la lógica vive en módulos `servicios.py`, para que las vistas solo
validen la entrada y llamen al servicio. Las rutas y los nombres de los campos JSON son los mismos que
usaba la versión anterior, por eso el frontend no tuvo que cambiar.

### Seguridad (referencia OWASP ASVS 5.0)

- **Autenticación (V6):** contraseñas con PBKDF2 (estándar de Django); los hashes bcrypt importados de la
  versión anterior siguen funcionando. Mínimo 10 caracteres, sin reglas de composición. Mensaje genérico
  en el login (no revela si el correo existe) y tiempo de respuesta igualado.
- **Recuperación:** token aleatorio de 256 bits, guardado solo como hash SHA-256, de un solo uso y con
  30 minutos de vigencia; la respuesta es igual exista o no el correo.
- **Sesiones (V7):** JWT HS256 de 2 h. Cambiar la contraseña o el rol, o desactivar al usuario, incrementa
  `version_sesion` e invalida de inmediato los tokens anteriores.
- **Autorización (V8):** por defecto toda ruta exige sesión (`RequiereSesion`); las públicas usan `Publico` y
  las del personal `Roles(...)`. El acceso a un pedido exige ser personal, el cliente dueño o tener el
  token de seguimiento; si no, se responde 404 (protección contra IDOR).
- **Validación (V2):** serializadores estrictos que rechazan campos no declarados; los precios nunca se
  aceptan del cliente.
- **Lógica de negocio:** cambios de estado condicionados al estado actual (sin condiciones de carrera),
  cupones con límite de usos dentro de una transacción, numeración de pedidos con reintento.
- **Pagos:** firma de integridad en el checkout, verificación de la firma de los eventos en tiempo
  constante, clave de idempotencia única por evento, validación de monto y moneda.
- **Configuración (V13):** CORS restringido a `FRONTEND_URL`, cabeceras de seguridad (nosniff, CSP,
  X-Frame-Options), límite de 100 kB por petición, rate limiting general (120/min) y estricto en login,
  registro y recuperación (5/min). `NUM_PROXIES` evita que se falsifique la IP con `X-Forwarded-For`.
- **Registro (V16):** tabla de auditoría para inicios de sesión, fallos, cambios de estado, pagos y acciones
  administrativas (sin secretos).
- **Datos personales (Ley 1581):** autorización explícita al registrarse y al pedir factura; los datos de
  facturación solo los ve el administrador.
- **Contenedores:** el backend corre con un usuario sin privilegios; los secretos se pasan por variables de
  entorno y nunca se guardan en el repositorio.

## Base de datos

Modelos en `*/models.py`, migraciones en `*/migrations/`. Puntos de integridad:

- Únicos: correo, número y código de mesa, número de pedido, referencia de pago, transacción del
  proveedor, clave de idempotencia de eventos de pago y una calificación por pedido (`OneToOne`).
- Restricción `CHECK` en la base de datos: las estrellas deben estar entre 1 y 5.
- Los productos no se borran (`PROTECT`, se marcan agotados) y los ítems guardan nombre y precio del momento
  de la compra.
- Índices por estado, fecha y llaves foráneas.

## Tiempo real

`nucleo/eventos.py` mantiene un bus en memoria y responde con `StreamingHttpResponse` (`text/event-stream`).
Por eso el backend corre con **un solo proceso de Gunicorn y varios hilos**. Para escalar a varias
instancias habría que usar Redis o `LISTEN/NOTIFY` de PostgreSQL. Nginx desactiva el búfer en las rutas
`/api/pedidos/.../eventos`.

## Máquina de estados del pedido

```
PENDIENTE ──(mesero/cocina)──▶ CONFIRMADO ──(cocina)──▶ EN_PREPARACION ──(cocina)──▶ LISTO ──(mesero)──▶ ENTREGADO
    │                               │
    └──(cliente, mesero, admin)─────┴──(mesero, admin)──▶ CANCELADO
```

Cancelar un pedido con pagos aprobados solo lo puede hacer un administrador, y esos pagos quedan en
`REEMBOLSO_SOLICITADO`.

## Frontend (`src/app`)

- `core/services`: API, sesión, carrito (estimación local + cotización del servidor), pedidos (SSE), panel
  del personal, mesa (código QR), solicitudes, calificaciones.
- `core/auth`: interceptor (agrega el token solo a la API propia) y guard por rol (solo navegación).
- `features`: inicio, entrada por QR, menú, carrito, seguimiento, pago, simulador, historial,
  autenticación, cocina, meseros, administración.
