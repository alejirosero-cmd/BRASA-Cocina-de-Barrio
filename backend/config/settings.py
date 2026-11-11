"""Configuración de Django para la API de BRASA – Cocina de Barrio."""
import os
from pathlib import Path

import dj_database_url

from .entorno import ErrorDeConfiguracion, cargar_archivo_env, numero, secreto, texto

BASE_DIR = Path(__file__).resolve().parent.parent
cargar_archivo_env(BASE_DIR / '.env')

ENTORNO = texto('ENTORNO', 'desarrollo')  # desarrollo | produccion | pruebas
ES_PRODUCCION = ENTORNO == 'produccion'
ES_PRUEBAS = ENTORNO == 'pruebas'

SECRET_KEY = secreto('DJANGO_SECRET_KEY')
JWT_SECRET = secreto('JWT_SECRET')
JWT_HORAS = numero('JWT_HORAS', 2, 1, 24)
DEBUG = texto('DEBUG', 'false').lower() == 'true' and not ES_PRODUCCION

FRONTEND_URL = texto('FRONTEND_URL', 'http://localhost:4200').rstrip('/')
ALLOWED_HOSTS = [h.strip() for h in texto('ALLOWED_HOSTS', 'localhost,127.0.0.1,backend').split(',') if h.strip()]

# --- Reglas de negocio ---
IMPUESTO_PORCENTAJE = numero('IMPUESTO_PORCENTAJE', 19, 0, 100)
PROPINA_MAX_PORCENTAJE = numero('PROPINA_MAX_PORCENTAJE', 20, 0, 100)

# --- Pagos ---
PAGOS_PROVEEDOR = texto('PAGOS_PROVEEDOR', 'simulado')
if PAGOS_PROVEEDOR not in ('simulado', 'wompi'):
    raise ErrorDeConfiguracion('PAGOS_PROVEEDOR debe ser "simulado" o "wompi"')
if PAGOS_PROVEEDOR == 'simulado' and ES_PRODUCCION:
    raise ErrorDeConfiguracion('El proveedor de pagos simulado no puede usarse en producción')
WOMPI = {
    'public_key': texto('WOMPI_PUBLIC_KEY'),
    'private_key': texto('WOMPI_PRIVATE_KEY'),
    'events_secret': texto('WOMPI_EVENTS_SECRET'),
    'integrity_secret': texto('WOMPI_INTEGRITY_SECRET'),
    'api_url': texto('WOMPI_API_URL', 'https://sandbox.wompi.co/v1'),
    'checkout_url': texto('WOMPI_CHECKOUT_URL', 'https://checkout.wompi.co/p/'),
}
if PAGOS_PROVEEDOR == 'wompi':
    faltantes = [k for k, v in WOMPI.items() if not v]
    if faltantes:
        raise ErrorDeConfiguracion(f'Faltan variables de Wompi: {", ".join(faltantes)}')
    if not ES_PRODUCCION and not WOMPI['public_key'].startswith('pub_test_'):
        raise ErrorDeConfiguracion('Fuera de producción solo se permiten llaves de pruebas de Wompi (pub_test_...)')

# --- Aplicaciones ---
INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'corsheaders',
    'rest_framework',
    'nucleo',
    'cuentas',
    'catalogo',
    'mesas',
    'pedidos',
    'solicitudes',
    'pagos',
    'calificaciones',
    'reportes',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'nucleo.middleware.CabecerasSeguridadMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
APPEND_SLASH = False  # Las rutas de la API no llevan "/" final (igual que el frontend las llama).

# --- Base de datos: SQLite en desarrollo, PostgreSQL en Docker/producción ---
DATABASES = {
    'default': dj_database_url.parse(
        texto('DATABASE_URL', f'sqlite:///{BASE_DIR / "db.sqlite3"}'),
        conn_max_age=60,
    )
}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# --- Seguridad HTTP ---
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'no-referrer'
X_FRAME_OPTIONS = 'DENY'
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024  # 100 kB por petición
if ES_PRODUCCION:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

CORS_ALLOWED_ORIGINS = [FRONTEND_URL]
CORS_ALLOW_HEADERS = ['content-type', 'authorization', 'x-pedido-token', 'accept']
CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
CORS_PREFLIGHT_MAX_AGE = 600

CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}

# --- Contraseñas: PBKDF2 por defecto; se aceptan los hashes bcrypt importados de la versión anterior ---
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.BCryptPasswordHasher',
]

# --- Django REST Framework ---
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['nucleo.autenticacion.AutenticacionJWT'],
    'DEFAULT_PERMISSION_CLASSES': ['nucleo.permisos.RequiereSesion'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser'],
    'EXCEPTION_HANDLER': 'nucleo.excepciones.manejar_excepcion',
    'UNAUTHENTICATED_USER': None,
    'DEFAULT_THROTTLE_CLASSES': ['nucleo.limites.LimiteGeneral'],
    # Cuántos proxies de confianza hay delante (0 = acceso directo, 1 = detrás de Nginx).
    # Evita que alguien falsifique X-Forwarded-For para saltarse el límite de intentos.
    'NUM_PROXIES': numero('NUM_PROXIES', 0, 0, 5),
    'DEFAULT_THROTTLE_RATES': {
        'general': '120/min',
        'estricto': '5/min',  # login, registro, recuperación
        'pedidos': '10/min',
        'cotizar': '60/min',
        'pagos': '10/min',
        'verificar': '20/min',
        'solicitudes': '6/min',
        'mesa': '20/min',
    },
}

LANGUAGE_CODE = 'es-co'
TIME_ZONE = 'America/Bogota'
USE_I18N = True
USE_TZ = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'consola': {'class': 'logging.StreamHandler'}},
    'loggers': {'brasa': {'handlers': ['consola'], 'level': os.environ.get('NIVEL_LOG', 'INFO')}},
}
