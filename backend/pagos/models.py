from django.db import models

from nucleo.models import nuevo_id


class Pago(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    pedido = models.ForeignKey('pedidos.Pedido', on_delete=models.PROTECT, related_name='pagos')
    proveedor = models.CharField(max_length=12)  # wompi | simulado | efectivo
    # Referencia única enviada al proveedor (clave de idempotencia).
    referencia = models.CharField(max_length=60, unique=True)
    monto = models.PositiveIntegerField()
    moneda = models.CharField(max_length=3, default='COP')
    # PENDIENTE | APROBADO | RECHAZADO | ANULADO | ERROR | REEMBOLSO_SOLICITADO | REEMBOLSADO
    estado = models.CharField(max_length=24, default='PENDIENTE', db_index=True)
    transaccion_proveedor_id = models.CharField(max_length=80, unique=True, null=True, blank=True)
    metodo = models.CharField(max_length=40, null=True, blank=True)
    registrado_por = models.ForeignKey('cuentas.Usuario', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    def publico(self) -> dict:
        return {
            'id': self.id, 'pedidoId': self.pedido_id, 'proveedor': self.proveedor, 'referencia': self.referencia,
            'monto': self.monto, 'moneda': self.moneda, 'estado': self.estado, 'metodo': self.metodo,
            'creadoEn': self.creado_en.isoformat().replace('+00:00', 'Z'),
            'actualizadoEn': self.actualizado_en.isoformat().replace('+00:00', 'Z'),
        }


class EventoPago(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    pago = models.ForeignKey(Pago, null=True, blank=True, on_delete=models.SET_NULL, related_name='eventos')
    # Identificador único del evento del proveedor: la misma notificación nunca se procesa dos veces.
    clave_idempotencia = models.CharField(max_length=200, unique=True)
    tipo = models.CharField(max_length=40)
    estado_reportado = models.CharField(max_length=24)
    firma_valida = models.BooleanField()
    payload = models.TextField()
    creado_en = models.DateTimeField(auto_now_add=True)
