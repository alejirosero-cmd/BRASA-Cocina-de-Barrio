# BRASA – Cocina de Barrio

Plataforma web progresiva (PWA) para pedir desde la mesa escaneando un código QR, seguir el pedido en
tiempo real y pagar desde el celular. Incluye paneles para cocina, meseros y administración.

| Capa | Tecnología |
|---|---|
| Frontend | Angular 22 (standalone, Signals) + Tailwind CSS 4, PWA con service worker |
| Backend | **Django 6.1 + Django REST Framework** (`backend/`) |
| Base de datos | SQLite en desarrollo · **PostgreSQL 17** en Docker y CI |
| Tiempo real | Server-Sent Events (SSE) |
| Pagos | Wompi (sandbox) o proveedor **simulado** para pruebas |
| Contenedores | Docker + Docker Compose; **Nginx** sirve la web y hace de proxy hacia `/api` |
| CI/CD | **GitLab CI/CD** (`.gitlab-ci.yml`): pruebas, build e imágenes Docker |
| Pruebas | Django TestCase (50 pruebas) · Vitest (7 pruebas) |

> La carpeta `server/` contiene la versión anterior del backend en NestJS. Ya no se usa: se conserva hasta
> que se decida eliminarla. Sus datos se pueden importar con `python manage.py importar_anterior`.

---

## Opción 1: todo con Docker (recomendado para mostrar el proyecto)

Requisito: Docker Desktop encendido.

```powershell
copy .env.example .env      # y cambia los secretos del archivo .env
docker compose up --build
```

Abre **http://localhost:8088**. Se levantan tres contenedores:

| Contenedor | Qué hace |
|---|---|
| `db` | PostgreSQL 17 con volumen persistente (`datos_postgres`) |
| `backend` | Django + Gunicorn; al arrancar aplica migraciones y carga los datos iniciales |
| `frontend` | Nginx con la web de Angular compilada; redirige `/api` al backend |

Detener: `docker compose down` (los datos se conservan). Borrar también los datos: `docker compose down -v`.

## Opción 2: desarrollo local (sin Docker)

Requisitos: Node.js 20+ y Python 3.12+.

```powershell
npm install
npm run api:instalar        # crea backend/.venv, instala Django, migra y carga los datos iniciales
copy backend\.env.example backend\.env   # y define DJANGO_SECRET_KEY y JWT_SECRET
```

En dos ventanas de PowerShell, desde la carpeta del proyecto:

```powershell
npm run api                 # API Django en http://localhost:8000/api
```

```powershell
npm start                   # Web en http://localhost:4200
```

### Usuarios

| Rol | Correo | Pantalla |
|---|---|---|
| Administrador | `admin@brasa.local` | `/admin` |
| Cocina | `cocina@brasa.local` | `/cocina` |
| Mesero | `mesero@brasa.local` | `/mesero` |
| Cliente | se registra en `/registro` (opcional: se puede pedir sin cuenta) | `/menu` |

Las contraseñas iniciales son las de `SEMILLA_ADMIN_PASSWORD` y `SEMILLA_DEMO_PASSWORD`. Para cambiar una:

```powershell
npm run usuario:clave -- admin@brasa.local "UnaClaveQueRecuerdes"
```

Los códigos QR de las mesas se ven e imprimen en **Admin → Mesas y QR**.

## Pruebas

```powershell
npm run api:test            # backend: 50 pruebas (unitarias + integración de la API)
npm test -- --watch=false   # frontend: 7 pruebas
```

## GitLab CI/CD

El archivo `.gitlab-ci.yml` define el pipeline que corre en cada push y merge request:

| Etapa | Job | Qué hace |
|---|---|---|
| `pruebas` | `backend:pruebas` | Python 3.14 + **PostgreSQL 17 como servicio**: `check`, verifica que no falten migraciones y corre las 50 pruebas |
| `pruebas` | `frontend:pruebas` | Node 24: pruebas de Angular con Vitest |
| `construccion` | `frontend:build` | Compilación de producción; queda como artefacto descargable |
| `imagenes` | `imagenes:docker` | Solo en la rama principal: construye las imágenes Docker y las publica en el Container Registry de GitLab |

Los secretos de las pruebas se generan en cada ejecución; no se guardan en el repositorio.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `ENTORNO` | `desarrollo`, `produccion` o `pruebas` |
| `DJANGO_SECRET_KEY`, `JWT_SECRET` | Secretos de ≥ 32 caracteres aleatorios. La API no arranca con los valores de ejemplo |
| `DATABASE_URL` | Vacío = SQLite. PostgreSQL: `postgres://usuario:clave@host:5432/brasa` |
| `FRONTEND_URL` | Origen permitido por CORS y base de los enlaces (QR, recuperación, retorno de pagos) |
| `NUM_PROXIES` | Proxies de confianza delante de la API: `0` en local, `1` detrás de Nginx |
| `JWT_HORAS` | Duración de la sesión (2 h) |
| `IMPUESTO_PORCENTAJE` | 19 por defecto. **Confírmalo con el contador**: los restaurantes suelen liquidar INC del 8 % |
| `PROPINA_MAX_PORCENTAJE` | Tope de la propina voluntaria (20) |
| `PAGOS_PROVEEDOR` | `simulado` (prohibido en producción) o `wompi` |
| `WOMPI_*` | Llaves del panel de Wompi; fuera de producción solo se aceptan llaves `pub_test_` |
| `SEMILLA_*` | Contraseñas de los usuarios iniciales que crea `python manage.py sembrar` |
| `POSTGRES_PASSWORD`, `PUERTO_WEB` | Solo para Docker Compose (archivo `.env` de la raíz) |

## Flujo principal

1. El cliente escanea el QR → `/m/:codigo` valida la mesa en el servidor.
2. Arma el carrito; el total y los cupones los calcula **el servidor** (`POST /api/pedidos/cotizar`).
3. Envía el pedido y recibe un token de seguimiento que guarda su navegador.
4. Cocina y meseros lo reciben en tiempo real; cada cambio de estado llega al cliente por SSE.
5. Paga todo o su parte (Wompi o simulador), o pide pagar en la mesa; el mesero registra el efectivo.
6. Al entregarse el pedido, el cliente puede calificarlo (1–5 estrellas, una sola vez).

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) y pendientes en [docs/PENDIENTES.md](docs/PENDIENTES.md).
