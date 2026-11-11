from django.conf import settings
from django.db import models

from nucleo.models import nuevo_id
from nucleo.seguridad import generar_codigo_mesa


class Mesa(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    numero = models.PositiveIntegerField(unique=True)
    # Código aleatorio impreso en el QR (y debajo de él) que identifica la mesa.
    codigo = models.CharField(max_length=12, unique=True, default=generar_codigo_mesa)
    activa = models.BooleanField(default=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['numero']

    @property
    def url(self) -> str:
        return f'{settings.FRONTEND_URL}/m/{self.codigo}'

    def publica(self) -> dict:
        return {'id': self.id, 'numero': self.numero, 'codigo': self.codigo, 'activa': self.activa, 'url': self.url}
