import json
import logging

from django.db import models

from .seguridad import generar_token

logger = logging.getLogger('brasa')


def nuevo_id() -> str:
    return generar_token(12)


class RegistroAuditoria(models.Model):
    """Registro de acciones sensibles (OWASP ASVS V16). Nunca guarda secretos."""

    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    actor = models.ForeignKey('cuentas.Usuario', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    accion = models.CharField(max_length=80)
    entidad = models.CharField(max_length=40)
    entidad_id = models.CharField(max_length=40, null=True, blank=True)
    detalle = models.TextField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['entidad', 'entidad_id']), models.Index(fields=['creado_en'])]


def registrar(accion: str, entidad: str, entidad_id, actor_id, detalle: dict | None = None) -> None:
    try:
        RegistroAuditoria.objects.create(
            accion=accion,
            entidad=entidad,
            entidad_id=entidad_id,
            actor_id=actor_id,
            detalle=json.dumps(detalle, ensure_ascii=False) if detalle else None,
        )
    except Exception:  # la auditoría no debe tumbar la operación principal, pero deja rastro
        logger.exception('No se pudo registrar %s sobre %s', accion, entidad)
