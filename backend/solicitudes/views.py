from django.utils import timezone
from rest_framework import serializers
from rest_framework.response import Response

from mesas.models import Mesa
from nucleo import eventos
from nucleo.dominio import MOTIVOS_SOLICITUD
from nucleo.excepciones import Conflicto, NoEncontrado, SolicitudInvalida
from nucleo.limites import Limite, LimiteGeneral
from nucleo.permisos import solo_clientes, usuario_de
from nucleo.serializadores import Estricto, validar
from nucleo.vistas import VistaPublica, vista_roles
from pedidos.servicios import obtener_con_acceso

from .models import SolicitudMesero


class CrearSolicitud(Estricto):
    motivo = serializers.ChoiceField(choices=MOTIVOS_SOLICITUD)
    codigoMesa = serializers.RegexField(r'^[A-Za-z0-9]{6,12}$', required=False,
                                        error_messages={'invalid': 'Código de mesa no válido'})
    # Alternativa para pedidos para llevar: el pedido y su token de seguimiento.
    pedidoId = serializers.CharField(max_length=40, required=False)


class SolicitudesVista(VistaPublica):
    """POST público (6 por minuto por IP); GET solo meseros y administrador."""

    def get_throttles(self):
        if self.request.method == 'POST':
            return [LimiteGeneral(), Limite('solicitudes')()]
        return super().get_throttles()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [p() for p in vista_roles('ADMIN', 'MESERO').permission_classes]
        return super().get_permissions()

    def get(self, request):
        pendientes = SolicitudMesero.objects.select_related('mesa').filter(estado='PENDIENTE').order_by('creado_en')
        return Response([s.publica() for s in pendientes])

    def post(self, request):
        solo_clientes(request, 'Llamar al mesero')
        d = validar(CrearSolicitud, request.data)
        if d.get('codigoMesa'):
            mesa = Mesa.objects.filter(codigo=d['codigoMesa'].upper(), activa=True).first()
            if not mesa:
                raise SolicitudInvalida('El código de mesa no es válido')
        elif d.get('pedidoId'):
            mesa = obtener_con_acceso(d['pedidoId'], request.headers.get('X-Pedido-Token'), usuario_de(request)).mesa
        else:
            raise SolicitudInvalida('Escanea el QR de tu mesa para llamar al mesero')

        # Sin duplicados: si ya hay una igual sin atender, se devuelve la misma.
        pendiente = SolicitudMesero.objects.select_related('mesa').filter(
            mesa=mesa, motivo=d['motivo'], estado='PENDIENTE').first()
        if pendiente:
            return Response({**pendiente.publica(), 'repetida': True}, status=201)
        solicitud = SolicitudMesero.objects.create(mesa=mesa, motivo=d['motivo'])
        datos = solicitud.publica()
        eventos.emitir('solicitud.actualizada', datos)
        return Response({**datos, 'repetida': False}, status=201)


class AtenderVista(vista_roles('ADMIN', 'MESERO')):
    def patch(self, request, id):
        cambiados = SolicitudMesero.objects.filter(id=id, estado='PENDIENTE').update(
            estado='ATENDIDA', atendida_por=request.user, atendida_en=timezone.now())
        if cambiados == 0:
            if not SolicitudMesero.objects.filter(id=id).exists():
                raise NoEncontrado('Solicitud no encontrada')
            raise Conflicto('La solicitud ya fue atendida')
        datos = SolicitudMesero.objects.select_related('mesa').get(id=id).publica()
        eventos.emitir('solicitud.actualizada', datos)
        return Response(datos)
