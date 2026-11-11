from collections import defaultdict
from datetime import timedelta

from django.db.models import Avg, Count, Sum
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework.response import Response

from calificaciones.models import Calificacion
from nucleo.vistas import vista_roles
from pagos.models import Pago
from pedidos.models import Pedido, PedidoItem


def _fecha(valor):
    try:
        return parse_datetime(valor) if valor else None
    except ValueError:
        return None


class ResumenVista(vista_roles('ADMIN')):
    def get(self, request):
        hasta = _fecha(request.query_params.get('hasta')) or timezone.now()
        desde = _fecha(request.query_params.get('desde')) or hasta - timedelta(days=30)
        pedidos = Pedido.objects.filter(creado_en__gte=desde, creado_en__lte=hasta)
        # Ventas = dinero efectivamente cobrado (pagos aprobados), no pedidos creados.
        pagos = Pago.objects.filter(estado='APROBADO', creado_en__gte=desde, creado_en__lte=hasta)

        ventas = pagos.aggregate(total=Sum('monto'), n=Count('id'))
        entregados = pedidos.filter(estado='ENTREGADO').aggregate(promedio=Avg('total'), n=Count('id'))
        calificacion = Calificacion.objects.filter(creado_en__gte=desde, creado_en__lte=hasta).aggregate(
            promedio=Avg('estrellas'), n=Count('id'))
        mas_vendidos = (
            PedidoItem.objects.filter(pedido__in=pedidos.exclude(estado='CANCELADO'))
            .values('nombre').annotate(cantidad=Sum('cantidad')).order_by('-cantidad')[:5]
        )
        por_dia = defaultdict(int)
        for monto, fecha in pagos.values_list('monto', 'creado_en'):
            por_dia[timezone.localtime(fecha).date().isoformat()] += monto

        return Response({
            'desde': desde.isoformat(),
            'hasta': hasta.isoformat(),
            'ventasTotales': ventas['total'] or 0,
            'pagosAprobados': ventas['n'],
            'pedidosPorEstado': {f['estado']: f['n'] for f in pedidos.values('estado').annotate(n=Count('id'))},
            'pedidosEntregados': entregados['n'],
            'ticketPromedio': round(entregados['promedio'] or 0),
            'masVendidos': [{'nombre': m['nombre'], 'cantidad': m['cantidad'] or 0} for m in mas_vendidos],
            'calificacionPromedio': round(calificacion['promedio'], 1) if calificacion['promedio'] is not None else None,
            'calificaciones': calificacion['n'],
            'ventasPorDia': [{'dia': d, 'total': t} for d, t in sorted(por_dia.items())],
        })
