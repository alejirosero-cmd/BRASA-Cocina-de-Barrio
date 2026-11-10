# BRASA – Cocina de Barrio

Plataforma web progresiva (PWA) para pedir desde la mesa escaneando un código QR, seguir el pedido en
tiempo real y pagar desde el celular. Incluye paneles para cocina, meseros y administración.

| Capa | Tecnología |
|---|---|
| Frontend | Angular 22 (componentes standalone, Signals), Tailwind CSS 4, PWA con service worker |
| Backend | NestJS 11 (`server/`), TypeScript |
| Base de datos | SQLite con Prisma 6 (migraciones en `server/prisma/migrations`) |
| Tiempo real | Server-Sent Events (SSE) |
| Pagos | Wompi (sandbox) o proveedor **simulado** para desarrollo |
| Pruebas | Jest + Supertest (backend), Vitest (frontend) |

## Requisitos

- Node.js 20 o superior (probado con 24.21) y npm 10+.
- No se necesita instalar ninguna base de datos: SQLite es un archivo local.

## Instalación

```bash
# 1. Dependencias del frontend (raíz del repositorio)
npm install

# 2. Dependencias del backend
cd server
npm install

# 3. Variables de entorno del backend
cp .env.example .env
#   Edita .env: como mínimo JWT_SECRET (≥ 32 caracteres aleatorios), SEED_ADMIN_PASSWORD y SEED_DEMO_PASSWORD.
#   Generar un secreto:  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 4. Crear la base de datos y cargar los datos iniciales (menú, 12 mesas, cupones, usuarios)
npx prisma migrate deploy
npm run db:seed
```

> npm 11 puede pedir aprobar los scripts de instalación de Prisma y esbuild:
> `npm install-scripts approve prisma @prisma/client @prisma/engines esbuild`.

## Ejecución en desarrollo

En dos terminales:

```bash
# Terminal 1 – API en http://localhost:3000/api
cd server && npm run start:dev

# Terminal 2 – Frontend en http://localhost:4200
npm start
```

Usuarios creados por el seed (las contraseñas son las que pusiste en `.env`):

| Rol | Correo | Pantalla |
|---|---|---|
| Administrador | `SEED_ADMIN_EMAIL` (por defecto admin@brasa.local) | `/admin` |
| Cocina | cocina@brasa.local (solo fuera de producción) | `/cocina` |
| Mesero | mesero@brasa.local (solo fuera de producción) | `/mesero` |
| Cliente | se registra en `/registro` (opcional: se puede pedir sin cuenta) | `/menu` |

¿Olvidaste una contraseña? Cámbiala desde la terminal, dentro de `server/`:

```bash
npm run usuario:clave -- admin@brasa.local "UnaClaveQueRecuerdes"
```

Los códigos QR de las mesas se ven e imprimen en **Admin → Mesas y QR**. Cada QR abre
`http://localhost:4200/m/<CODIGO>`; el código también se puede escribir a mano en la página de inicio.

## Variables de entorno (`server/.env`)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NODE_ENV` | no | `development` (por defecto), `production` o `test` |
| `PORT` | no | Puerto de la API (3000) |
| `FRONTEND_URL` | sí | Origen permitido por CORS y base de los enlaces (QR, recuperación, retorno de pagos) |
| `DATABASE_URL` | sí | `file:./dev.db` (relativo a `server/prisma/`) |
| `JWT_SECRET` | sí | ≥ 32 caracteres aleatorios. La API no arranca con el valor de ejemplo |
| `JWT_EXPIRES_IN` | no | Duración de la sesión (`2h`) |
| `IMPUESTO_PORCENTAJE` | no | Impuesto sobre (subtotal − descuento). Por defecto 19 (valor original de la app). **Confírmalo con el contador**: los restaurantes suelen liquidar INC del 8 % |
| `PROPINA_MAX_PORCENTAJE` | no | Tope de la propina voluntaria (20) |
| `PAGOS_PROVEEDOR` | no | `simulado` (desarrollo, prohibido en producción) o `wompi` |
| `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET` | si `wompi` | Llaves del panel de Wompi. Fuera de producción solo se aceptan llaves `pub_test_` |
| `WOMPI_API_URL`, `WOMPI_CHECKOUT_URL` | no | Sandbox por defecto |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | para el seed | Administrador inicial |
| `SEED_DEMO_PASSWORD` | para el seed | Contraseña de cocina@ y mesero@ (no se crean en producción) |

El frontend usa `src/environments/environment.development.ts` (`apiUrl: http://localhost:3000/api`) con
`ng serve`, y `environment.ts` (`apiUrl: /api`, mismo dominio) en el build de producción.

### Configurar Wompi (sandbox)

1. Crea una cuenta en <https://comercios.wompi.co> y copia las llaves de **pruebas** en `.env`.
2. `PAGOS_PROVEEDOR=wompi`.
3. En *Desarrolladores → Eventos* registra la URL pública `https://<tu-dominio>/api/pagos/webhook/wompi`
   (en local puedes usar un túnel). Sin webhook el pago igual se confirma: al volver del checkout la API
   consulta la transacción directamente a Wompi.

## Pruebas

```bash
cd server && npm test        # 69 pruebas: unitarias + integración de la API (base SQLite propia, test/e2e.db)
npm test -- --watch=false    # (raíz) pruebas unitarias del frontend con Vitest
```

Las pruebas de integración no tocan la base de desarrollo ni servicios externos y usan el proveedor de
pagos simulado.

## Build de producción

```bash
npm run build                 # frontend → dist/brasa-cocina-de-barrio/browser
cd server && npm run build    # API → server/dist
NODE_ENV=production node dist/main.js
```

En producción sirve el frontend y la API bajo el mismo dominio (la API en `/api`) detrás de HTTPS.

## Flujo principal

1. El cliente escanea el QR → `/m/:codigo` valida la mesa en el servidor.
2. Arma el carrito; el total y los cupones los calcula **el servidor** (`POST /api/pedidos/cotizar`).
3. Envía el pedido (`POST /api/pedidos`) y recibe un token de seguimiento que guarda su navegador.
4. Cocina y meseros lo reciben en tiempo real; cada cambio de estado llega al cliente por SSE.
5. El cliente paga todo o su parte (Wompi o simulador), o pide pagar en mesa; el mesero registra efectivo.
6. Al entregarse el pedido, el cliente puede calificarlo (1–5 estrellas, una sola vez).

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) y pendientes en [docs/PENDIENTES.md](docs/PENDIENTES.md).
