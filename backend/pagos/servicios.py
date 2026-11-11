import json
import logging
from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from nucleo import eventos
from nucleo.excepciones import Conflicto, NoEncontrado, SolicitudInvalida
from nucleo.models import registrar
from nucleo.seguridad import generar_token
from pedidos import servicios as pedidos
from pedidos.models import Pedido

from .models import EventoPago, Pago
from .proveedores import ResultadoVerificado, proveedor_actual

logger = logging.getLogger('brasa')

MONTO_MINIMO = 1500  # pago mínimo por transacción en línea (COP)
MINUTOS_REUTILIZAR = 30  # un pago pendiente igual y reciente se reutiliza (evita cobros por doble clic)


def _saldo(pedido: Pedido) -> int:
    return pedido.total - sum(p.monto for p in pedido.pagos.all() if p.estado == 'APROBADO')


def iniciar(pedido_id: str, monto, token, usuario) -> dict:
    """Inicia un pago en línea por el saldo pendiente o por una parte (cuenta dividida)."""
    proveedor = proveedor_actual()
    pedido = pedidos.obtener_con_acceso(pedido_id, token, usuario)
    if pedido.estado == 'CANCELADO':
        raise Conflicto('El pedido está cancelado')
    saldo = _saldo(pedido)
    if saldo <= 0:
        raise Conflicto('El pedido ya está pagado')
    valor = saldo if monto is None else monto
    if valor > saldo:
        raise SolicitudInvalida(f'El monto debe ser un entero de máximo {saldo} COP')
    if valor < min(MONTO_MINIMO, saldo):
        raise SolicitudInvalida(f'El monto mínimo por pago es {MONTO_MINIMO} COP')

    url_retorno = f'{settings.FRONTEND_URL}/pago/resultado?pedido={quote(pedido_id)}'
    reciente = Pago.objects.filter(
        pedido=pedido, monto=valor, estado='PENDIENTE', proveedor=proveedor.nombre,
        creado_en__gte=timezone.now() - timedelta(minutes=MINUTOS_REUTILIZAR),
    ).order_by('-creado_en').first()
    pago = reciente or Pago.objects.create(
        pedido=pedido, proveedor=proveedor.nombre, monto=valor,
        # Referencia impredecible y única: también es la clave de idempotencia ante el proveedor.
        referencia=f'BRASA-{pedido.numero}-{generar_token(9)}',
    )
    if not reciente:
        registrar('pago.iniciado', 'Pago', pago.id, usuario.id if usuario else None, {'monto': valor})
    return {'pago': pago.publico(), 'urlCheckout': proveedor.url_checkout(pago.referencia, pago.monto, url_retorno)}


def procesar_webhook(cuerpo) -> str:
    resultado = proveedor_actual().verificar_webhook(cuerpo)
    if resultado is None:
        return 'firma_invalida'
    return aplicar_resultado(resultado)


def verificar_transaccion(pedido_id: str, transaccion_id: str, token, usuario) -> dict:
    """Al volver del checkout, el estado se consulta directamente al proveedor."""
    pedidos.obtener_con_acceso(pedido_id, token, usuario)
    resultado = proveedor_actual().consultar_transaccion(transaccion_id)
    if resultado:
        pago = Pago.objects.filter(referencia=resultado.referencia).first()
        if not pago or pago.pedido_id != pedido_id:  # la transacción debe ser de este pedido
            raise NoEncontrado('Transacción no encontrada')
        aplicar_resultado(resultado)
    return pedidos.recargar(pedido_id)


def aplicar_resultado(r: ResultadoVerificado) -> str:
    """
    Aplica un resultado verificado de forma idempotente:
    1) registra el evento con una clave única (si ya existía, no hace nada más);
    2) comprueba monto y moneda contra lo que se cobró;
    3) solo cambia pagos que aún no tienen estado final.
    """
    pago = Pago.objects.filter(referencia=r.referencia).first()
    try:
        with transaction.atomic():
            EventoPago.objects.create(
                pago=pago, clave_idempotencia=r.clave_idempotencia, tipo=r.tipo, estado_reportado=r.estado,
                firma_valida=True, payload=json.dumps(r.payload, ensure_ascii=False, default=str)[:20000],
            )
    except IntegrityError:
        return 'duplicado'

    if not pago:
        logger.warning('Evento para una referencia desconocida: %s', r.referencia)
        return 'desconocido'

    if r.monto_centavos != pago.monto * 100 or r.moneda != pago.moneda:
        Pago.objects.filter(id=pago.id).update(estado='ERROR')
        registrar('pago.inconsistente', 'Pago', pago.id, None,
                  {'esperado': pago.monto * 100, 'recibido': r.monto_centavos, 'moneda': r.moneda})
        return 'inconsistente'

    if r.estado == 'PENDIENTE':
        return 'ignorado'
    # Un pago anulado localmente (pedido cancelado) puede llegar aprobado más tarde: se registra
    # para no perder el dinero del cliente y queda pendiente de reembolso.
    desde_validos = ['PENDIENTE', 'ANULADO'] if r.estado == 'APROBADO' else ['PENDIENTE']
    estado_pedido = Pedido.objects.values_list('estado', flat=True).get(id=pago.pedido_id)
    estado_final = 'REEMBOLSO_SOLICITADO' if r.estado == 'APROBADO' and estado_pedido == 'CANCELADO' else r.estado

    cambiados = Pago.objects.filter(id=pago.id, estado__in=desde_validos).update(
        estado=estado_final, transaccion_proveedor_id=r.transaccion_id, metodo=r.metodo, actualizado_en=timezone.now())
    if cambiados == 0:
        return 'ignorado'
    registrar('pago.estado', 'Pago', pago.id, None, {'estado': estado_final, 'proveedor': pago.proveedor})
    _recalcular_estado_pedido(pago.pedido_id)
    return 'aplicado'


def registrar_efectivo(pedido_id: str, monto, usuario) -> dict:
    """Pago en efectivo o datáfono registrado por el mesero."""
    pedido = Pedido.objects.prefetch_related('pagos').filter(id=pedido_id).first()
    if not pedido:
        raise NoEncontrado('Pedido no encontrado')
    if pedido.estado == 'CANCELADO':
        raise Conflicto('El pedido está cancelado')
    saldo = _saldo(pedido)
    if saldo <= 0:
        raise Conflicto('El pedido ya está pagado')
    valor = saldo if monto is None else monto
    if not 0 < valor <= saldo:
        raise SolicitudInvalida(f'El monto debe estar entre 1 y {saldo} COP')
    pago = Pago.objects.create(
        pedido=pedido, proveedor='efectivo', referencia=f'EFE-{pedido.numero}-{generar_token(9)}', monto=valor,
        estado='APROBADO', metodo='EFECTIVO_O_DATAFONO', registrado_por=usuario,
    )
    registrar('pago.efectivo', 'Pago', pago.id, usuario.id, {'monto': valor})
    _recalcular_estado_pedido(pedido_id)
    return pago.publico()


def cambiar_estado_admin(pago_id: str, desde: str, hacia: str, usuario) -> dict:
    """Reembolso en dos pasos: marcar para devolver y confirmar que se devolvió en el panel del proveedor."""
    if Pago.objects.filter(id=pago_id, estado=desde).update(estado=hacia, actualizado_en=timezone.now()) == 0:
        raise Conflicto(f'El pago debe estar en estado {desde}')
    pago = Pago.objects.get(id=pago_id)
    registrar(f'pago.{hacia.lower()}', 'Pago', pago_id, usuario.id)
    _recalcular_estado_pedido(pago.pedido_id)
    return pago.publico()


def historial(pagina: int) -> dict:
    qs = Pago.objects.select_related('pedido').order_by('-creado_en')
    return {'total': qs.count(), 'pagina': pagina,
            'pagos': [{**p.publico(), 'pedidoNumero': f'#{p.pedido.numero}'} for p in qs[(pagina - 1) * 50: pagina * 50]]}


def pagos_del_pedido(pedido_id: str, token, usuario) -> list:
    pedidos.obtener_con_acceso(pedido_id, token, usuario)
    return [p.publico() for p in Pago.objects.filter(pedido_id=pedido_id).order_by('-creado_en')]


def _recalcular_estado_pedido(pedido_id: str) -> None:
    pedido = Pedido.objects.prefetch_related('pagos').get(id=pedido_id)
    aprobado = sum(p.monto for p in pedido.pagos.all() if p.estado == 'APROBADO')
    reembolsado = any(p.estado in ('REEMBOLSADO', 'REEMBOLSO_SOLICITADO') for p in pedido.pagos.all())
    estado_pago = 'PENDIENTE'
    if aprobado >= pedido.total:
        estado_pago = 'PAGADO'
    elif aprobado > 0:
        estado_pago = 'PARCIAL'
    elif reembolsado:
        estado_pago = 'REEMBOLSADO'
    if aprobado > pedido.total:
        registrar('pago.excedente', 'Pedido', pedido_id, None, {'aprobado': aprobado, 'total': pedido.total})
    Pedido.objects.filter(id=pedido_id).update(estado_pago=estado_pago, actualizado_en=timezone.now())
    serializado = pedidos.recargar(pedido_id)
    pedidos.emitir(serializado)
    eventos.emitir('pago.actualizado', {'pedidoId': pedido_id, 'estadoPago': estado_pago}, pedido_id=pedido_id)
