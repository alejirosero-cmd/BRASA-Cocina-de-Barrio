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


METODOS_PRESENCIALES = {'EFECTIVO': 'efectivo', 'TARJETA': 'datafono'}
SEGUNDOS_POSIBLE_DUPLICADO = 120


def registrar_presencial(pedido_id: str, datos: dict, usuario) -> dict:
    """
    Cobro recibido en la mesa (efectivo o datáfono), registrado por un mesero con permiso o por la caja.

    Protecciones: la clave de registro hace que un reintento devuelva el mismo pago; el pedido se
    bloquea mientras se calcula el saldo (dos meseros a la vez no pueden cobrar de más); nunca se
    cobra más que el saldo; y un pago igual hecho hace instantes pide confirmación explícita.
    Con datáfono se exige el código de aprobación del comprobante: registrar un pago con tarjeta
    no es suponer que fue aprobado.
    """
    from nucleo.permisos import puede_cobrar
    from rest_framework import exceptions

    if not puede_cobrar(usuario):
        raise exceptions.PermissionDenied('No tienes permiso para registrar cobros. Pídeselo al administrador.')
    metodo = datos['metodo']
    clave = datos['clave']
    with transaction.atomic():
        pedido = Pedido.objects.select_for_update().filter(id=pedido_id).first()
        if not pedido:
            raise NoEncontrado('Pedido no encontrado')
        previo = Pago.objects.filter(clave_registro=clave).first()
        if previo:
            if previo.pedido_id != pedido.id:
                raise Conflicto('Esa clave de registro ya se usó en otro pedido')
            return previo.publico()  # reintento del mismo cobro: no se duplica
        if pedido.estado == 'CANCELADO':
            raise Conflicto('El pedido está cancelado')
        saldo = _saldo(Pedido.objects.prefetch_related('pagos').get(id=pedido.id))
        if saldo <= 0:
            raise Conflicto('El pedido ya está pagado')
        valor = datos.get('monto') or saldo
        if not 0 < valor <= saldo:
            raise SolicitudInvalida(f'El monto debe estar entre 1 y {saldo} COP (saldo pendiente)')
        codigo = (datos.get('codigoAutorizacion') or '').strip().upper() or None
        recibido = datos.get('efectivoRecibido')
        if metodo == 'TARJETA':
            if not codigo:
                raise SolicitudInvalida('Escribe el código de aprobación que aparece en el comprobante del datáfono')
            if Pago.objects.filter(pedido=pedido, proveedor='datafono', codigo_autorizacion=codigo, estado='APROBADO').exists():
                raise Conflicto('Ese comprobante del datáfono ya se registró en este pedido')
            recibido = None
        elif recibido is not None and recibido < valor:
            raise SolicitudInvalida('El efectivo recibido no alcanza para cubrir el monto')
        hace_poco = timezone.now() - timedelta(seconds=SEGUNDOS_POSIBLE_DUPLICADO)
        repetido = Pago.objects.filter(pedido=pedido, proveedor=METODOS_PRESENCIALES[metodo], monto=valor,
                                       estado='APROBADO', creado_en__gte=hace_poco).exists()
        if repetido and not datos.get('confirmarDuplicado'):
            raise Conflicto('Ya se registró un cobro igual hace un momento. Si de verdad es otro pago, confírmalo.')
        pago = Pago.objects.create(
            pedido=pedido, proveedor=METODOS_PRESENCIALES[metodo],
            referencia=f'{"EFE" if metodo == "EFECTIVO" else "DAT"}-{pedido.numero}-{generar_token(9)}',
            monto=valor, estado='APROBADO', metodo=metodo, registrado_por=usuario, clave_registro=clave,
            codigo_autorizacion=codigo, efectivo_recibido=recibido,
        )
        registrar('pago.presencial', 'Pago', pago.id, usuario.id,
                  {'metodo': metodo, 'monto': valor, 'codigoAutorizacion': codigo, 'pedido': pedido.numero})
    _recalcular_estado_pedido(pedido_id)
    return {**pago.publico(), 'cambio': (recibido - valor) if recibido is not None else None}


def anular_presencial(pago_id: str, motivo: str, usuario) -> dict:
    """Solo el administrador anula un cobro en la mesa, con motivo y antes del cierre de caja."""
    with transaction.atomic():
        pago = Pago.objects.select_for_update().filter(id=pago_id).first()
        if not pago:
            raise NoEncontrado('Pago no encontrado')
        if pago.proveedor not in METODOS_PRESENCIALES.values():
            raise Conflicto('Los pagos en línea no se anulan aquí: usa el reembolso')
        if pago.estado != 'APROBADO':
            raise Conflicto('Solo se puede anular un pago aprobado')
        if pago.cierre_id:
            raise Conflicto('Este pago ya está en un cierre de caja y no se puede anular')
        pago.estado = 'ANULADO'
        pago.anulado_por = usuario
        pago.anulado_en = timezone.now()
        pago.motivo_anulacion = motivo
        pago.save(update_fields=['estado', 'anulado_por', 'anulado_en', 'motivo_anulacion', 'actualizado_en'])
        registrar('pago.anulado', 'Pago', pago.id, usuario.id, {'motivo': motivo, 'monto': pago.monto})
    _recalcular_estado_pedido(pago.pedido_id)
    return _con_detalle(pago.id)


# ---------------------------------------------------------------- caja
def _pagos_sin_cerrar():
    return Pago.objects.select_related('pedido', 'registrado_por').filter(estado='APROBADO', cierre__isnull=True)


def _agrupar(pagos) -> dict:
    total = {'efectivo': 0, 'datafono': 0, 'en_linea': 0}
    for p in pagos:
        grupo = p.proveedor if p.proveedor in ('efectivo', 'datafono') else 'en_linea'
        total[grupo] += p.monto
    return total


def resumen_caja() -> dict:
    """Lo que hay desde el último cierre: totales por método, por quién cobró y cuentas abiertas."""
    from .models import CierreCaja

    pagos = list(_pagos_sin_cerrar())
    total = _agrupar(pagos)
    por_persona: dict = {}
    for p in pagos:
        nombre = p.registrado_por.nombre if p.registrado_por_id else 'Pago en línea (cliente)'
        por_persona[nombre] = por_persona.get(nombre, 0) + p.monto
    ultimo = CierreCaja.objects.first()
    abiertas = [
        {'id': x.id, 'numero': f'#{x.numero}', 'mesa': x.mesa.numero if x.mesa_id else None, 'saldo': _saldo(x)}
        for x in Pedido.objects.select_related('mesa').prefetch_related('pagos')
        .filter(estado='ENTREGADO', estado_pago__in=['PENDIENTE', 'PARCIAL'])
    ]
    anulados = Pago.objects.filter(estado='ANULADO', anulado_en__isnull=False)
    if ultimo:
        anulados = anulados.filter(anulado_en__gte=ultimo.hasta)
    anulados = anulados.count()
    return {
        'desde': ultimo.hasta.isoformat().replace('+00:00', 'Z') if ultimo else None,
        'totalEfectivo': total['efectivo'], 'totalDatafono': total['datafono'], 'totalEnLinea': total['en_linea'],
        'total': sum(total.values()), 'cantidadPagos': len(pagos), 'anulados': anulados,
        'porPersona': [{'nombre': n, 'total': v} for n, v in sorted(por_persona.items(), key=lambda kv: -kv[1])],
        'cuentasAbiertas': abiertas,
    }


def cerrar_caja(efectivo_contado: int, notas: str, confirmar_pendientes: bool, usuario) -> dict:
    """
    Cierra la caja: asigna al cierre todos los pagos aprobados que no tenían cierre y guarda la
    diferencia entre el efectivo esperado y el contado. Si hay cuentas entregadas sin pagar, pide
    confirmación: no se cierra la caja sin revisar el saldo pendiente.
    """
    from .models import CierreCaja

    with transaction.atomic():
        resumen = resumen_caja()
        if resumen['cuentasAbiertas'] and not confirmar_pendientes:
            raise Conflicto(f'Hay {len(resumen["cuentasAbiertas"])} cuenta(s) entregadas sin pagar. Revísalas o confirma el cierre.')
        pagos = list(_pagos_sin_cerrar().select_for_update(of=('self',)))
        total = _agrupar(pagos)
        ultimo = CierreCaja.objects.first()
        cierre = CierreCaja.objects.create(
            realizado_por=usuario, desde=ultimo.hasta if ultimo else None, hasta=timezone.now(),
            total_efectivo=total['efectivo'], total_datafono=total['datafono'], total_en_linea=total['en_linea'],
            cantidad_pagos=len(pagos), efectivo_contado=efectivo_contado,
            diferencia=efectivo_contado - total['efectivo'], notas=notas,
        )
        Pago.objects.filter(id__in=[p.id for p in pagos]).update(cierre=cierre)
        registrar('caja.cierre', 'CierreCaja', cierre.id, usuario.id,
                  {'efectivoContado': efectivo_contado, 'diferencia': cierre.diferencia, 'pagos': len(pagos)})
    return cierre.publico()


def cierres(pagina: int) -> dict:
    from .models import CierreCaja

    qs = CierreCaja.objects.select_related('realizado_por')
    return {'total': qs.count(), 'cierres': [c.publico() for c in qs[(pagina - 1) * 20: pagina * 20]]}


def _con_detalle(pago_id: str) -> dict:
    p = Pago.objects.select_related('pedido', 'registrado_por', 'anulado_por').get(id=pago_id)
    return {**p.para_caja(), 'pedidoNumero': f'#{p.pedido.numero}'}


def cambiar_estado_admin(pago_id: str, desde: str, hacia: str, usuario) -> dict:
    """Reembolso en dos pasos: marcar para devolver y confirmar que se devolvió en el panel del proveedor."""
    if Pago.objects.filter(id=pago_id, estado=desde).update(estado=hacia, actualizado_en=timezone.now()) == 0:
        raise Conflicto(f'El pago debe estar en estado {desde}')
    pago = Pago.objects.get(id=pago_id)
    registrar(f'pago.{hacia.lower()}', 'Pago', pago_id, usuario.id)
    _recalcular_estado_pedido(pago.pedido_id)
    return pago.publico()


def historial(pagina: int) -> dict:
    qs = Pago.objects.select_related('pedido', 'registrado_por', 'anulado_por').order_by('-creado_en')
    return {'total': qs.count(), 'pagina': pagina,
            'pagos': [{**p.para_caja(), 'pedidoNumero': f'#{p.pedido.numero}'} for p in qs[(pagina - 1) * 50: pagina * 50]]}


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
