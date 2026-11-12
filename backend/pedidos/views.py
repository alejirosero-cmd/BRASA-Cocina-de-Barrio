from django.utils.dateparse import parse_datetime
from rest_framework import exceptions
from rest_framework.response import Response

from nucleo import eventos
from nucleo.dominio import ESTADOS_PEDIDO
from nucleo.limites import Limite, LimiteGeneral
from nucleo.permisos import solo_clientes, usuario_de
from nucleo.serializadores import validar
from nucleo.vistas import VistaPublica, entero, vista_roles

from . import serializers as s
from . import servicios
from .models import Pedido


def _token(request):
    return request.headers.get('X-Pedido-Token')


def _fecha(valor):
    try:
        return parse_datetime(valor) if valor else None
    except ValueError:
        return None


class PedidosVista(VistaPublica):
    """POST público (cliente con QR o con sesión, 10 por minuto por IP); GET solo administrador."""

    def get_throttles(self):
        if self.request.method == 'POST':
            return [LimiteGeneral(), Limite('pedidos')()]
        return super().get_throttles()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [p() for p in vista_roles('ADMIN').permission_classes]
        return super().get_permissions()

    def post(self, request):
        usuario = usuario_de(request)
        # La cocina prepara los pedidos, no los toma. El mesero sí puede tomarlo en la mesa.
        if usuario is not None and usuario.rol == 'COCINA':
            raise exceptions.PermissionDenied('La cocina no toma pedidos: los toma el cliente con el QR o el mesero en la mesa')
        return Response(servicios.crear(validar(s.CrearPedido, request.data), usuario), status=201)

    def get(self, request):
        estado = request.query_params.get('estado')
        return Response(servicios.listar(
            estado if estado in ESTADOS_PEDIDO else None,
            _fecha(request.query_params.get('desde')),
            _fecha(request.query_params.get('hasta')),
            entero(request.query_params.get('pagina'), 1, 1, 1000),
        ))


class CotizarVista(VistaPublica):
    """Total calculado por el servidor para mostrar en el carrito (no crea nada ni gasta el cupón)."""

    throttle_classes = [LimiteGeneral, Limite('cotizar')]

    def post(self, request):
        return Response(servicios.cotizar(validar(s.Cotizar, request.data)))


class ActivosVista(vista_roles('ADMIN', 'MESERO', 'COCINA')):
    def get(self, request):
        return Response(servicios.listar_activos())


class MiosVista(vista_roles('CLIENTE')):
    def get(self, request):
        return Response(servicios.listar_del_cliente(request.user))


class EventosPersonalVista(vista_roles('ADMIN', 'MESERO', 'COCINA')):
    """Flujo en tiempo real para el personal: todos los cambios de pedidos, solicitudes y pagos."""

    throttle_classes = []
    renderer_classes = eventos.RENDERIZADORES_SSE

    def get(self, request):
        return eventos.respuesta_sse(lambda e: True)


class PedidoVista(VistaPublica):
    def get(self, request, id):
        return Response(servicios.serializar_pedido(servicios.obtener_con_acceso(id, _token(request), usuario_de(request))))


class EventosPedidoVista(VistaPublica):
    """Flujo en tiempo real de un solo pedido (pantalla de seguimiento del cliente)."""

    throttle_classes = []
    renderer_classes = eventos.RENDERIZADORES_SSE

    def get(self, request, id):
        servicios.obtener_con_acceso(id, _token(request), usuario_de(request))
        return eventos.respuesta_sse(lambda e: e['pedido_id'] == id and e['tipo'] == 'pedido.actualizado')


class EstadoVista(vista_roles('ADMIN', 'MESERO', 'COCINA')):
    def patch(self, request, id):
        d = validar(s.CambiarEstado, request.data)
        return Response(servicios.cambiar_estado(id, d['estado'], d.get('nota'), request.user))


class CancelarVista(VistaPublica):
    def post(self, request, id):
        solo_clientes(request, 'Cancelar desde el seguimiento')
        return Response(servicios.cancelar_por_cliente(id, _token(request), usuario_de(request)), status=201)


class PropinaVista(VistaPublica):
    def patch(self, request, id):
        solo_clientes(request, 'Elegir la propina')
        porcentaje = validar(s.Propina, request.data)['porcentaje']
        return Response(servicios.cambiar_propina(id, porcentaje, _token(request), usuario_de(request)))


class FacturaVista(VistaPublica):
    """POST: el cliente guarda sus datos. GET: solo el administrador puede leerlos (datos personales)."""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [p() for p in vista_roles('ADMIN').permission_classes]
        return super().get_permissions()

    def post(self, request, id):
        solo_clientes(request, 'Pedir la factura electrónica')
        d = validar(s.DatosFactura, request.data)
        return Response(servicios.guardar_datos_factura(id, d, _token(request), usuario_de(request)), status=201)

    def get(self, request, id):
        pedido = Pedido.objects.filter(id=id).only('datos_factura').first()
        return Response(pedido.datos_factura if pedido else None)
