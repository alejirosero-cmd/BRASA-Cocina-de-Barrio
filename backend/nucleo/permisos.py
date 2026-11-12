"""
Permisos validados en el servidor. Por defecto toda ruta exige sesión (RequiereSesion);
las rutas públicas usan Publico y las del personal, Roles(...).
"""
from rest_framework import exceptions
from rest_framework.permissions import BasePermission

from .dominio import ROLES_PERSONAL


def usuario_de(request):
    usuario = getattr(request, 'user', None)
    return usuario if usuario is not None and getattr(usuario, 'is_authenticated', False) else None


class Publico(BasePermission):
    def has_permission(self, request, view):
        return True


class RequiereSesion(BasePermission):
    def has_permission(self, request, view):
        if usuario_de(request) is None:
            mensaje = 'La sesión expiró o no es válida' if getattr(request, '_token_invalido', False) else 'Debes iniciar sesión'
            raise exceptions.NotAuthenticated(mensaje)
        return True


def Roles(*roles: str):
    """Fábrica de permisos: solo los roles indicados pueden usar la ruta."""

    class _Roles(RequiereSesion):
        def has_permission(self, request, view):
            super().has_permission(request, view)
            if request.user.rol not in roles:
                raise exceptions.PermissionDenied('No tienes permiso para realizar esta acción')
            return True

    _Roles.__name__ = f'Roles_{"_".join(roles)}'
    return _Roles


def es_personal(usuario) -> bool:
    return usuario is not None and usuario.rol in ROLES_PERSONAL


def puede_cobrar(usuario) -> bool:
    """Registrar un cobro en la mesa: el administrador (caja) o un mesero con el permiso activado."""
    return usuario is not None and (usuario.rol == 'ADMIN' or (usuario.rol == 'MESERO' and usuario.puede_cobrar))


def solo_clientes(request, accion: str) -> None:
    """
    Acciones que son del cliente (pagar en línea, dejar propina, calificar, pedir factura, llamar al
    mesero, cancelar su propio pedido). El personal no las hace en nombre del cliente.
    """
    if es_personal(usuario_de(request)):
        raise exceptions.PermissionDenied(f'{accion} lo hace el cliente desde su celular, no el personal del restaurante')
