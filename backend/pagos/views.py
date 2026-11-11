from django.conf import settings
from rest_framework import exceptions, serializers
from rest_framework.response import Response

from nucleo.excepciones import NoEncontrado, SolicitudInvalida
from nucleo.limites import Limite, LimiteGeneral
from nucleo.permisos import usuario_de
from nucleo.serializadores import Estricto, validar
from nucleo.vistas import VistaPublica, entero, vista_roles

from . import servicios
from .models import Pago
from .proveedores import ProveedorSimulado, proveedor_actual


class IniciarPago(Estricto):
    pedidoId = serializers.CharField(max_length=40)
    monto = serializers.IntegerField(min_value=1, max_value=100_000_000, required=False)


class VerificarPago(Estricto):
    pedidoId = serializers.CharField(max_length=40)
    transaccionId = serializers.RegexField(r'^[\w-]{5,64}$')


class Efectivo(Estricto):
    pedidoId = serializers.CharField(max_length=40)
    monto = serializers.IntegerField(min_value=1, max_value=100_000_000, required=False)


class Simular(Estricto):
    aprobar = serializers.BooleanField()


def _token(request):
    return request.headers.get('X-Pedido-Token')


class ProveedorVista(VistaPublica):
    def get(self, request):
        return Response({'proveedor': proveedor_actual().nombre})


class PagosVista(VistaPublica):
    """POST público: iniciar pago (10 por minuto por IP). GET: historial, solo administrador."""

    def get_throttles(self):
        if self.request.method == 'POST':
            return [LimiteGeneral(), Limite('pagos')()]
        return super().get_throttles()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [p() for p in vista_roles('ADMIN').permission_classes]
        return super().get_permissions()

    def post(self, request):
        d = validar(IniciarPago, request.data)
        return Response(servicios.iniciar(d['pedidoId'], d.get('monto'), _token(request), usuario_de(request)), status=201)

    def get(self, request):
        return Response(servicios.historial(entero(request.query_params.get('pagina'), 1, 1, 1000)))


class VerificarVista(VistaPublica):
    throttle_classes = [LimiteGeneral, Limite('verificar')]

    def post(self, request):
        d = validar(VerificarPago, request.data)
        return Response(servicios.verificar_transaccion(d['pedidoId'], d['transaccionId'], _token(request), usuario_de(request)))


class WebhookWompiVista(VistaPublica):
    """Notificaciones de Wompi. Registra esta URL en el panel de Wompi (Desarrolladores → Eventos)."""

    throttle_classes = []

    def post(self, request):
        if settings.PAGOS_PROVEEDOR != 'wompi':
            raise NoEncontrado()
        resultado = servicios.procesar_webhook(request.data)
        if resultado == 'firma_invalida':
            raise SolicitudInvalida('Firma inválida')
        return Response({'recibido': True, 'resultado': resultado})


class SimuladoVista(VistaPublica):
    """Solo existe con el proveedor simulado y fuera de producción."""

    def post(self, request, referencia):
        if settings.PAGOS_PROVEEDOR != 'simulado' or settings.ES_PRODUCCION:
            raise exceptions.PermissionDenied('El simulador de pagos no está habilitado')
        aprobar = validar(Simular, request.data)['aprobar']
        pago = Pago.objects.filter(referencia=referencia, proveedor='simulado').first()
        if not pago:
            raise NoEncontrado('Pago no encontrado')
        resultado = servicios.aplicar_resultado(ProveedorSimulado().resultado(referencia, pago.monto, aprobar))
        return Response({'resultado': resultado, 'pedidoId': pago.pedido_id})


class DelPedidoVista(VistaPublica):
    def get(self, request, pedido_id):
        return Response(servicios.pagos_del_pedido(pedido_id, _token(request), usuario_de(request)))


class EfectivoVista(vista_roles('ADMIN', 'MESERO')):
    def post(self, request):
        d = validar(Efectivo, request.data)
        return Response(servicios.registrar_efectivo(d['pedidoId'], d.get('monto'), request.user), status=201)


class ReembolsoVista(vista_roles('ADMIN')):
    def patch(self, request, id):
        return Response(servicios.cambiar_estado_admin(id, 'APROBADO', 'REEMBOLSO_SOLICITADO', request.user))


class ReembolsadoVista(vista_roles('ADMIN')):
    def patch(self, request, id):
        return Response(servicios.cambiar_estado_admin(id, 'REEMBOLSO_SOLICITADO', 'REEMBOLSADO', request.user))
