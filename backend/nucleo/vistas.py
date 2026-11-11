from rest_framework.views import APIView

from .permisos import Publico, Roles


class VistaPublica(APIView):
    permission_classes = [Publico]


def vista_roles(*roles):
    """Clase base de una vista restringida a ciertos roles."""
    return type('VistaRoles', (APIView,), {'permission_classes': [Roles(*roles)]})


def entero(valor, por_defecto: int, minimo: int, maximo: int) -> int:
    try:
        n = int(valor)
    except (TypeError, ValueError):
        return por_defecto
    return max(minimo, min(maximo, n))
