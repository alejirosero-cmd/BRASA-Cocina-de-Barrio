"""
Inicio de sesión del personal con Keycloak (OpenID Connect).

El navegador obtiene un access token de Keycloak (flujo Authorization Code + PKCE) y lo envía a
POST /api/auth/keycloak. Aquí se verifica la firma con las llaves públicas del realm (RS256), el emisor,
el cliente y la vigencia; el rol del personal sale de los roles del realm. Si todo es válido se entrega
una sesión normal de BRASA, así el resto de la API (y sus permisos) funciona igual.
"""
import logging
from functools import lru_cache

import jwt
from django.conf import settings
from django.contrib.auth.hashers import make_password
from rest_framework import exceptions

from nucleo.excepciones import NoEncontrado
from nucleo.models import registrar

from .models import Usuario
from .servicios import sesion

logger = logging.getLogger('brasa')

# Si una cuenta tiene varios roles del personal, gana el de mayor privilegio.
PRIORIDAD_ROLES = ('ADMIN', 'MESERO', 'COCINA')


def configuracion_publica() -> dict | None:
    """Lo que el frontend necesita para redirigir a Keycloak (nada secreto)."""
    kc = settings.KEYCLOAK
    if not kc:
        return None
    return {'url': kc['url'], 'realm': kc['realm'], 'cliente': kc['cliente']}


@lru_cache(maxsize=4)
def _cliente_jwks(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url, cache_keys=True, lifespan=3600, timeout=10)


def _clave_publica(token: str):
    return _cliente_jwks(settings.KEYCLOAK['jwks']).get_signing_key_from_jwt(token).key


def verificar_token(token: str) -> dict:
    kc = settings.KEYCLOAK
    try:
        reclamos = jwt.decode(
            token,
            _clave_publica(token),
            algorithms=['RS256'],
            issuer=kc['emisor'],
            options={'require': ['exp', 'iat', 'iss', 'sub'], 'verify_aud': False},
            leeway=30,
        )
    except jwt.PyJWKClientError as e:
        logger.error('No se pudieron obtener las llaves de Keycloak: %s', e)
        raise exceptions.AuthenticationFailed('No se pudo verificar la sesión con Keycloak') from e
    except jwt.PyJWTError as e:
        raise exceptions.AuthenticationFailed('La sesión de Keycloak no es válida o expiró') from e
    # El token debe haber sido emitido para la web de BRASA (no para otro cliente del realm).
    if reclamos.get('azp') != kc['cliente'] or reclamos.get('typ') not in (None, 'Bearer'):
        raise exceptions.AuthenticationFailed('La sesión de Keycloak no es válida para BRASA')
    return reclamos


def iniciar_sesion(token: str) -> dict:
    if not settings.KEYCLOAK:
        raise NoEncontrado('El inicio de sesión con Keycloak no está habilitado')
    reclamos = verificar_token(token)

    roles = set((reclamos.get('realm_access') or {}).get('roles') or [])
    rol = next((r for r in PRIORIDAD_ROLES if r in roles), None)
    if rol is None:
        raise exceptions.PermissionDenied('Tu cuenta de Keycloak no tiene un rol del personal de BRASA')
    email = (reclamos.get('email') or '').strip().lower()
    if not email or reclamos.get('email_verified') is False:
        raise exceptions.AuthenticationFailed('Tu cuenta de Keycloak necesita un correo verificado')

    nombre = (reclamos.get('name') or reclamos.get('preferred_username') or email.split('@')[0])[:80]
    usuario = Usuario.objects.filter(email=email).first()
    if usuario is None:
        # Cuenta creada desde Keycloak: no tiene contraseña local utilizable.
        usuario = Usuario.objects.create(email=email, nombre=nombre, rol=rol, password_hash=make_password(None))
        registrar('usuario.creado_keycloak', 'Usuario', usuario.id, usuario.id, {'rol': rol})
    else:
        if not usuario.activo:
            raise exceptions.AuthenticationFailed('Tu cuenta está desactivada en BRASA')
        if usuario.rol != rol:
            # Keycloak es la fuente de verdad del rol del personal; el cambio cierra las sesiones anteriores.
            registrar('usuario.rol_keycloak', 'Usuario', usuario.id, usuario.id, {'antes': usuario.rol, 'ahora': rol})
            usuario.rol = rol
            usuario.version_sesion += 1
            usuario.save(update_fields=['rol', 'version_sesion', 'actualizado_en'])
    registrar('sesion.keycloak', 'Usuario', usuario.id, usuario.id)
    return sesion(usuario)
