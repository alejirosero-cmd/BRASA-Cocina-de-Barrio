import io

import qrcode
import qrcode.image.svg
from django.http import HttpResponse
from rest_framework import serializers
from rest_framework.response import Response

from nucleo.excepciones import Conflicto, NoEncontrado
from nucleo.limites import Limite, LimiteGeneral
from nucleo.models import registrar
from nucleo.seguridad import generar_codigo_mesa
from nucleo.serializadores import Estricto, validar
from nucleo.vistas import VistaPublica, vista_roles

from .models import Mesa


class CrearMesa(Estricto):
    numero = serializers.IntegerField(min_value=1, max_value=999)


class ActualizarMesa(Estricto):
    activa = serializers.BooleanField()


def _mesa(id) -> Mesa:
    mesa = Mesa.objects.filter(id=id).first()
    if not mesa:
        raise NoEncontrado('Mesa no encontrada')
    return mesa


class ResolverCodigoVista(VistaPublica):
    """
    Consulta pública a partir del código del QR o del número de la mesa (1, 01, 12...).
    Devuelve el número y el código, que es lo que se usa después para enviar el pedido.
    """

    throttle_classes = [LimiteGeneral, Limite('mesa')]

    def get(self, request, codigo):
        valor = codigo.strip().upper()
        if valor.isdigit() and len(valor) <= 3:
            mesa = Mesa.objects.filter(numero=int(valor), activa=True).first()
        else:
            mesa = Mesa.objects.filter(codigo=valor, activa=True).first()
        if not mesa:
            raise NoEncontrado('El código de mesa no es válido')
        return Response({'numero': mesa.numero, 'codigo': mesa.codigo})


class MesasVista(vista_roles('ADMIN', 'MESERO')):
    def get(self, request):
        return Response([m.publica() for m in Mesa.objects.all()])

    def post(self, request):
        if request.user.rol != 'ADMIN':
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied('No tienes permiso para realizar esta acción')
        numero = validar(CrearMesa, request.data)['numero']
        if Mesa.objects.filter(numero=numero).exists():
            raise Conflicto(f'La mesa {numero} ya existe')
        mesa = Mesa.objects.create(numero=numero)
        registrar('mesa.creada', 'Mesa', mesa.id, request.user.id, {'numero': numero})
        return Response(mesa.publica(), status=201)


class MesaVista(vista_roles('ADMIN')):
    def patch(self, request, id):
        mesa = _mesa(id)
        mesa.activa = validar(ActualizarMesa, request.data)['activa']
        mesa.save(update_fields=['activa'])
        registrar('mesa.actualizada', 'Mesa', id, request.user.id, {'activa': mesa.activa})
        return Response(mesa.publica())


class RegenerarCodigoVista(vista_roles('ADMIN')):
    """Invalida el QR anterior (p. ej. si alguien lo fotografió y hace pedidos falsos)."""

    def post(self, request, id):
        mesa = _mesa(id)
        mesa.codigo = generar_codigo_mesa()
        mesa.save(update_fields=['codigo'])
        registrar('mesa.qr_regenerado', 'Mesa', id, request.user.id)
        return Response(mesa.publica(), status=201)


class QrVista(vista_roles('ADMIN')):
    def get(self, request, id):
        mesa = _mesa(id)
        qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=1,
                           image_factory=qrcode.image.svg.SvgPathImage)
        qr.add_data(mesa.url)
        salida = io.BytesIO()
        qr.make_image().save(salida)
        respuesta = HttpResponse(salida.getvalue(), content_type='image/svg+xml')
        respuesta['Cache-Control'] = 'no-store'
        return respuesta
