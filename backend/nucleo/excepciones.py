"""
Errores de la API con un formato único: {"statusCode": 400, "message": "...", "error": "..."}.
El frontend muestra `message` al usuario; nunca se envían detalles internos.
"""
import logging

from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger('brasa')


class SolicitudInvalida(exceptions.APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Solicitud inválida'


class NoEncontrado(exceptions.APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'No encontrado'


class Conflicto(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Conflicto'


_NOMBRES = {400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
            409: 'Conflict', 413: 'Payload Too Large', 415: 'Unsupported Media Type', 429: 'Too Many Requests'}


def _mensajes(detalle) -> list[str]:
    """Aplana los errores de validación de DRF a una lista de textos."""
    if isinstance(detalle, dict):
        salida = []
        for valor in detalle.values():
            salida.extend(_mensajes(valor))
        return salida
    if isinstance(detalle, list):
        salida = []
        for valor in detalle:
            salida.extend(_mensajes(valor))
        return salida
    return [str(detalle)]


def manejar_excepcion(exc, context):
    if isinstance(exc, Http404):
        exc = NoEncontrado()
    if isinstance(exc, exceptions.Throttled):
        exc.detail = 'Demasiados intentos. Espera un momento e intenta de nuevo.'
    respuesta = exception_handler(exc, context)
    if respuesta is None:
        logger.exception('Error no controlado', exc_info=exc)
        return Response({'statusCode': 500, 'message': 'Error interno del servidor'}, status=500)

    codigo = respuesta.status_code
    if isinstance(exc, exceptions.ValidationError):
        mensaje = _mensajes(exc.detail)
    else:
        mensaje = str(exc.detail) if hasattr(exc, 'detail') else 'Error'
    respuesta.data = {'statusCode': codigo, 'message': mensaje, 'error': _NOMBRES.get(codigo, 'Error')}
    return respuesta
