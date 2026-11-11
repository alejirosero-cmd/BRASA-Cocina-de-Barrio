from django.db import models

from nucleo.models import nuevo_id


class Cupon(models.Model):
    codigo = models.CharField(primary_key=True, max_length=30)
    porcentaje = models.PositiveIntegerField()
    activo = models.BooleanField(default=True)
    usos_max = models.PositiveIntegerField(null=True, blank=True)
    usos = models.PositiveIntegerField(default=0)
    vence_en = models.DateTimeField(null=True, blank=True)


class Pedido(models.Model):
    ESTADOS = [(e, e) for e in ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO')]
    ESTADOS_PAGO = [(e, e) for e in ('PENDIENTE', 'PARCIAL', 'PAGADO', 'REEMBOLSADO')]

    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    numero = models.PositiveIntegerField(unique=True)
    tipo = models.CharField(max_length=10)  # mesa | llevar
    mesa = models.ForeignKey('mesas.Mesa', null=True, blank=True, on_delete=models.SET_NULL, related_name='pedidos')
    cliente = models.ForeignKey('cuentas.Usuario', null=True, blank=True, on_delete=models.SET_NULL, related_name='pedidos')
    estado = models.CharField(max_length=20, choices=ESTADOS, default='PENDIENTE', db_index=True)
    estado_pago = models.CharField(max_length=12, choices=ESTADOS_PAGO, default='PENDIENTE')
    subtotal = models.PositiveIntegerField()
    descuento = models.PositiveIntegerField(default=0)
    impuestos = models.PositiveIntegerField()
    propina_porcentaje = models.PositiveIntegerField(default=0)
    propina = models.PositiveIntegerField(default=0)
    total = models.PositiveIntegerField()
    cupon = models.ForeignKey(Cupon, null=True, blank=True, on_delete=models.SET_NULL, related_name='pedidos')
    notas_cocina = models.CharField(max_length=300, blank=True, default='')
    tiempo_estimado_min = models.PositiveIntegerField()
    # Hash SHA-256 del token que permite al cliente anónimo consultar su pedido.
    token_seguimiento_hash = models.CharField(max_length=64, unique=True)
    # Datos de facturación electrónica (con autorización de tratamiento de datos).
    datos_factura = models.JSONField(null=True, blank=True)
    motivo_cancelacion = models.CharField(max_length=200, null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True, db_index=True)
    actualizado_en = models.DateTimeField(auto_now=True)


class PedidoItem(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='items')
    producto = models.ForeignKey('catalogo.Producto', on_delete=models.PROTECT, related_name='items')
    # Copia del nombre y del precio al momento de la compra.
    nombre = models.CharField(max_length=80)
    precio_unitario = models.PositiveIntegerField()
    cantidad = models.PositiveIntegerField()
    personalizacion = models.JSONField(default=dict)


class EventoPedido(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    pedido = models.ForeignKey(Pedido, on_delete=models.CASCADE, related_name='eventos')
    estado = models.CharField(max_length=20)
    actor = models.ForeignKey('cuentas.Usuario', null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    nota = models.CharField(max_length=200, null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['creado_en']
