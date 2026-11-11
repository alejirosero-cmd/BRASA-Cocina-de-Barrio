"""
Autenticación con JWT (HS256). El usuario se vuelve a leer de la base de datos en cada
petición: si fue desactivado o cambió su contraseña/rol (version_sesion), el token deja de valer.
"""
from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication


def crear_token(usuario) -> str:
    ahora = datetime.now(timezone.utc)
    carga = {
        'sub': usuario.id,
        'rol': usuario.rol,
        'v': usuario.version_sesion,
        'iat': ahora,
        'exp': ahora + timedelta(hours=settings.JWT_HORAS),
    }
    return jwt.encode(carga, settings.JWT_SECRET, algorithm='HS256')


class AutenticacionJWT(BaseAuthentication):
    """
    Sin cabecera: petición anónima (la vista decide si la permite).
    Con un token inválido en una ruta pública se trata como anónima; en una privada, 401.
    """

    def authenticate(self, request):
        cabecera = request.headers.get('Authorization', '')
        tipo, _, token = cabecera.partition(' ')
        if tipo != 'Bearer' or not token:
            return None
        from cuentas.models import Usuario

        try:
            carga = jwt.decode(token, settings.JWT_SECRET, algorithms=['HS256'])
            usuario = Usuario.objects.get(id=carga['sub'])
        except (jwt.PyJWTError, KeyError, Usuario.DoesNotExist):
            return self._invalido(request)
        if not usuario.activo or usuario.version_sesion != carga.get('v'):
            return self._invalido(request)
        return (usuario, token)

    def _invalido(self, request):
        request._token_invalido = True
        return None

    def authenticate_header(self, request):
        return 'Bearer'
