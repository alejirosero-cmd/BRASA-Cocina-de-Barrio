from django.db import IntegrityError, transaction
from django.db.models import Avg, Count
from rest_framework import serializers
from rest_framework.response import Response

from nucleo.excepciones import Conflicto
from nucleo.models import registrar
from nucleo.permisos import usuario_de
from nucleo.serializadores import Estricto, validar
from nucleo.vistas import VistaPublica, entero, vista_roles
from pedidos.servicios import obtener_con_acceso

from .models import Calificacion


class CrearCalificacion(Estricto):
    pedidoId = serializers.CharField(max_length=40)
    estrellas = serializers.IntegerField(min_value=1, max_value=5, error_messages={
        'min_value': 'La calificación mínima es 1 estrella',
        'max_value': 'La calificación máxima es 5 estrellas',
        'invalid': 'La calificación debe ser un número entero',
    })
    comentario = serializers.CharField(max_length=500, required=False, allow_blank=True,
                                       error_messages={'max_length': 'El comentario admite máximo 500 caracteres'})


def resumen() -> dict:
    agregado = Calificacion.objects.aggregate(promedio=Avg('estrellas'), total=Count('id'))
    distribucion = {n: 0 for n in range(1, 6)}
    for fila in Calificacion.objects.values('estrellas').annotate(n=Count('id')):
        distribucion[fila['estrellas']] = fila['n']
    return {
        'promedio': round(agregado['promedio'], 1) if agregado['promedio'] is not None else None,
        'total': agregado['total'],
        'distribucion': distribucion,
    }


class CalificacionesVista(VistaPublica):
    """POST público (con token del pedido). GET: listado, solo administrador."""

    def get_permissions(self):
        if self.request.method == 'GET':
            return [p() for p in vista_roles('ADMIN').permission_classes]
        return super().get_permissions()

    def post(self, request):
        d = validar(CrearCalificacion, request.data)
        usuario = usuario_de(request)
        pedido = obtener_con_acceso(d['pedidoId'], request.headers.get('X-Pedido-Token'), usuario)
        if pedido.estado != 'ENTREGADO':
            raise Conflicto('Solo puedes calificar pedidos que ya fueron entregados')
        try:
            # La restricción UNIQUE impide duplicados incluso con dos peticiones simultáneas.
            with transaction.atomic():
                c = Calificacion.objects.create(pedido=pedido, estrellas=d['estrellas'],
                                                comentario=(d.get('comentario') or '').strip())
        except IntegrityError as e:
            raise Conflicto('Este pedido ya fue calificado') from e
        registrar('calificacion.creada', 'Pedido', pedido.id, usuario.id if usuario else None)
        return Response({'id': c.id, 'pedidoId': c.pedido_id, 'estrellas': c.estrellas, 'comentario': c.comentario,
                         'creadoEn': c.creado_en}, status=201)

    def get(self, request):
        pagina = entero(request.query_params.get('pagina'), 1, 1, 1000)
        qs = Calificacion.objects.select_related('pedido').order_by('-creado_en')[(pagina - 1) * 50: pagina * 50]
        return Response([{'id': c.id, 'pedidoNumero': f'#{c.pedido.numero}', 'estrellas': c.estrellas,
                          'comentario': c.comentario, 'creadoEn': c.creado_en} for c in qs])


class ResumenVista(VistaPublica):
    def get(self, request):
        return Response(resumen())
