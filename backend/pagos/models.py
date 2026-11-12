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
    # Quién registró el cobro en la mesa (mesero o caja). Fecha y hora quedan en creado_en.
    registrado_por = models.ForeignKey('cuentas.Usuario', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    # Cobro en la mesa: clave única por intento (un reintento no duplica el cobro).
    clave_registro = models.CharField(max_length=64, unique=True, null=True, blank=True)
    # Datáfono: código de aprobación impreso en el comprobante (sin él no se registra el pago).
    codigo_autorizacion = models.CharField(max_length=12, null=True, blank=True)
    efectivo_recibido = models.PositiveIntegerField(null=True, blank=True)
    # Anulación: solo el administrador, con motivo, y solo si el pago no entró en un cierre de caja.
    anulado_por = models.ForeignKey('cuentas.Usuario', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    anulado_en = models.DateTimeField(null=True, blank=True)
    motivo_anulacion = models.CharField(max_length=200, null=True, blank=True)
    cierre = models.ForeignKey('pagos.CierreCaja', null=True, blank=True, on_delete=models.PROTECT, related_name='pagos')
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    def publico(self) -> dict:
        return {
            'id': self.id, 'pedidoId': self.pedido_id, 'proveedor': self.proveedor, 'referencia': self.referencia,
            'monto': self.monto, 'moneda': self.moneda, 'estado': self.estado, 'metodo': self.metodo,
            'creadoEn': self.creado_en.isoformat().replace('+00:00', 'Z'),
            'actualizadoEn': self.actualizado_en.isoformat().replace('+00:00', 'Z'),
        }

    def para_caja(self) -> dict:
        """Detalle completo para el administrador (trazabilidad)."""
        fecha = lambda d: d.isoformat().replace('+00:00', 'Z') if d else None  # noqa: E731
        return {
            **self.publico(),
            'registradoPor': self.registrado_por.nombre if self.registrado_por_id else None,
            'codigoAutorizacion': self.codigo_autorizacion,
            'efectivoRecibido': self.efectivo_recibido,
            'anuladoPor': self.anulado_por.nombre if self.anulado_por_id else None,
            'anuladoEn': fecha(self.anulado_en),
            'motivoAnulacion': self.motivo_anulacion,
            'cierreId': self.cierre_id,
        }


class CierreCaja(models.Model):
    """Cierre de caja: totales de los pagos aprobados desde el cierre anterior, y el efectivo contado."""

    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    realizado_por = models.ForeignKey('cuentas.Usuario', on_delete=models.PROTECT, related_name='+')
    desde = models.DateTimeField(null=True, blank=True)
    hasta = models.DateTimeField()
    total_efectivo = models.PositiveIntegerField(default=0)
    total_datafono = models.PositiveIntegerField(default=0)
    total_en_linea = models.PositiveIntegerField(default=0)
    cantidad_pagos = models.PositiveIntegerField(default=0)
    efectivo_contado = models.PositiveIntegerField()
    diferencia = models.IntegerField(default=0)  # contado − esperado (negativo = falta dinero)
    notas = models.CharField(max_length=300, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-hasta']

    def publico(self) -> dict:
        fecha = lambda d: d.isoformat().replace('+00:00', 'Z') if d else None  # noqa: E731
        return {
            'id': self.id, 'realizadoPor': self.realizado_por.nombre, 'desde': fecha(self.desde), 'hasta': fecha(self.hasta),
            'totalEfectivo': self.total_efectivo, 'totalDatafono': self.total_datafono, 'totalEnLinea': self.total_en_linea,
            'total': self.total_efectivo + self.total_datafono + self.total_en_linea,
            'cantidadPagos': self.cantidad_pagos, 'efectivoContado': self.efectivo_contado,
            'diferencia': self.diferencia, 'notas': self.notas,
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
