"""Límite de peticiones por IP (rate limiting), general y por tipo de ruta."""
import os

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle


class _LimitePorIP(SimpleRateThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}

    def allow_request(self, request, view):
        # Solo las pruebas automáticas pueden desactivarlo; nunca en desarrollo ni producción.
        if settings.ES_PRUEBAS and os.environ.get('BRASA_SIN_LIMITES') == '1':
            return True
        return super().allow_request(request, view)


class LimiteGeneral(_LimitePorIP):
    scope = 'general'


def Limite(alcance: str):
    """Límite adicional y más estricto para una ruta concreta."""
    return type(f'Limite_{alcance}', (_LimitePorIP,), {'scope': alcance})
