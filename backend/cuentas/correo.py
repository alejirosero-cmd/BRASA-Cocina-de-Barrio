"""
Envío de correos. En desarrollo el mensaje se escribe en la consola del servidor; en las
pruebas queda en BUZON_PRUEBAS. Para producción falta configurar SMTP (ver docs/PENDIENTES.md).
"""
import logging

from django.conf import settings

logger = logging.getLogger('brasa')
BUZON_PRUEBAS: list[tuple[str, str]] = []


def enviar_recuperacion(destino: str, enlace: str) -> None:
    if settings.ES_PRUEBAS:
        BUZON_PRUEBAS.append((destino, enlace))
    elif settings.ES_PRODUCCION:
        logger.error('No hay transporte de correo configurado para producción')
    else:
        logger.info('[DESARROLLO] Correo de recuperación para %s: %s', destino, enlace)
