from django.db import models

from nucleo.models import nuevo_id


class SolicitudMesero(models.Model):
    MOTIVOS = [('cuenta', 'Cuenta'), ('utensilios', 'Utensilios'), ('ayuda', 'Ayuda')]

    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    mesa = models.ForeignKey('mesas.Mesa', null=True, blank=True, on_delete=models.SET_NULL, related_name='solicitudes')
    motivo = models.CharField(max_length=12, choices=MOTIVOS)
    estado = models.CharField(max_length=10, default='PENDIENTE', db_index=True)  # PENDIENTE | ATENDIDA
    atendida_por = models.ForeignKey('cuentas.Usuario', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    creado_en = models.DateTimeField(auto_now_add=True)
    atendida_en = models.DateTimeField(null=True, blank=True)

    def publica(self) -> dict:
        return {
            'id': self.id,
            'motivo': self.motivo,
            'mesa': self.mesa.numero if self.mesa else None,
            'estado': self.estado,
            'creadaEn': self.creado_en.isoformat().replace('+00:00', 'Z'),
            'atendidaEn': self.atendida_en.isoformat().replace('+00:00', 'Z') if self.atendida_en else None,
        }
