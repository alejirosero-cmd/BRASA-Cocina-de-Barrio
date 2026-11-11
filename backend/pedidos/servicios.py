from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import F, Max, Q
from django.utils import timezone
from rest_framework import exceptions

from catalogo.models import Producto
from mesas.models import Mesa
from nucleo import eventos
from nucleo.dominio import ESTADOS_ACTIVOS, puede_transicionar
from nucleo.excepciones import Conflicto, NoEncontrado, SolicitudInvalida
from nucleo.models import registrar
from nucleo.permisos import es_personal
from nucleo.seguridad import generar_token, iguales, sha256

from .models import Cupon, EventoPedido, Pedido, PedidoItem
from .precios import ErrorDePedido, ProductoParaPrecio, _redondear, calcular_linea, calcular_totales, estimar_tiempo


def _consulta():
    return Pedido.objects.select_related('mesa').prefetch_related('items__producto', 'pagos')


def serializar_pedido(p: Pedido) -> dict:
    """Representación pública; compatible con el modelo `Pedido` del frontend."""
    pagado = sum(x.monto for x in p.pagos.all() if x.estado == 'APROBADO')
    return {
        'id': p.id,
        'numero': f'#{p.numero}',
        'tipo': p.tipo,
        'mesa': {'tipo': p.tipo, 'numero': p.mesa.numero if p.mesa else None},
        'estado': p.estado,
        'estadoPago': p.estado_pago,
        'items': [
            {
                'id': i.id,
                'productoId': i.producto.slug,
                'nombre': i.nombre,
                'imagenUrl': i.producto.imagen_url,
                'precioUnitario': i.precio_unitario,
                'precioBase': i.precio_unitario,
                'cantidad': i.cantidad,
                'personalizacion': {'extras': [], 'salsas': [], 'retirados': [], 'instrucciones': '', **(i.personalizacion or {})},
            }
            for i in p.items.all()
        ],
        'resumen': {'subtotal': p.subtotal, 'descuento': p.descuento, 'impuestos': p.impuestos,
                    'propina': p.propina, 'total': p.total},
        'propinaPorcentaje': p.propina_porcentaje,
        'cupon': p.cupon_id,
        'pagado': pagado,
        'saldo': max(0, p.total - pagado),
        'notasCocina': p.notas_cocina,
        'tiempoEstimadoMin': p.tiempo_estimado_min,
        'facturaSolicitada': p.datos_factura is not None,
        'calificado': hasattr(p, 'calificacion'),
        'motivoCancelacion': p.motivo_cancelacion,
        'creadoEn': p.creado_en.isoformat().replace('+00:00', 'Z'),
        'actualizadoEn': p.actualizado_en.isoformat().replace('+00:00', 'Z'),
    }


def recargar(pedido_id: str) -> dict:
    return serializar_pedido(_consulta().get(id=pedido_id))


def emitir(serializado: dict) -> None:
    eventos.emitir('pedido.actualizado', serializado, pedido_id=serializado['id'])


# ---------------------------------------------------------------- creación y cotización
def _validar_propina(pct: int) -> None:
    if pct > settings.PROPINA_MAX_PORCENTAJE:
        raise SolicitudInvalida(f'La propina no puede superar el {settings.PROPINA_MAX_PORCENTAJE} %')


def _preparar_lineas(items: list):
    """Precios siempre desde el catálogo de la base de datos."""
    slugs = {i['productoId'] for i in items}
    registros = {p.slug: p for p in Producto.objects.filter(slug__in=slugs)}
    productos = [
        ProductoParaPrecio(slug=r.slug, nombre=r.nombre, precio=r.precio, disponible=r.disponible,
                           tiempo_preparacion_min=r.tiempo_preparacion_min, tamanos=r.tamanos or [],
                           extras=r.extras or [], salsas=r.salsas or [], retirables=r.retirables or [])
        for r in registros.values()
    ]
    try:
        lineas = []
        for item in items:
            producto = next((p for p in productos if p.slug == item['productoId']), None)
            if producto is None:
                raise ErrorDePedido(f'El producto "{item["productoId"]}" no existe')
            lineas.append(calcular_linea(producto, item))
    except ErrorDePedido as e:
        raise SolicitudInvalida(str(e)) from e
    return registros, productos, lineas


def _resolver_cupon(codigo_solicitado: str | None, consumir: bool) -> tuple[int, str | None]:
    if not codigo_solicitado:
        return 0, None
    codigo = codigo_solicitado.strip().upper()
    consulta = Cupon.objects.filter(codigo=codigo)
    if consumir:
        consulta = consulta.select_for_update()
    cupon = consulta.first()
    vigente = (cupon and cupon.activo and (cupon.vence_en is None or cupon.vence_en > timezone.now())
               and (cupon.usos_max is None or cupon.usos < cupon.usos_max))
    if not vigente:
        raise SolicitudInvalida('El cupón no es válido o está vencido')
    if consumir:
        Cupon.objects.filter(codigo=codigo).update(usos=F('usos') + 1)
    return cupon.porcentaje, codigo


def cotizar(datos: dict) -> dict:
    """Vista previa del total con las reglas del servidor, sin crear el pedido ni gastar el cupón."""
    propina_pct = datos.get('propinaPorcentaje', 0)
    _validar_propina(propina_pct)
    _, productos, lineas = _preparar_lineas(datos['items'])
    descuento_pct, cupon = _resolver_cupon(datos.get('cupon'), consumir=False)
    return {
        **calcular_totales(lineas, descuento_pct, settings.IMPUESTO_PORCENTAJE, propina_pct),
        'cupon': cupon,
        'descuentoPorcentaje': descuento_pct,
        'impuestoPorcentaje': settings.IMPUESTO_PORCENTAJE,
        'tiempoEstimadoMin': estimar_tiempo(productos, lineas),
        'lineas': [{'productoId': l['producto_slug'], 'precioUnitario': l['precio_unitario'], 'cantidad': l['cantidad']} for l in lineas],
    }


def crear(datos: dict, usuario) -> dict:
    propina_pct = datos.get('propinaPorcentaje', 0)
    _validar_propina(propina_pct)

    # La mesa se identifica por el código del QR, nunca por un número escrito a mano.
    mesa = None
    if datos['tipo'] == 'mesa':
        if not datos.get('codigoMesa'):
            raise SolicitudInvalida('Escanea el código QR de tu mesa')
        mesa = Mesa.objects.filter(codigo=datos['codigoMesa'].upper(), activa=True).first()
        if not mesa:
            raise SolicitudInvalida('El código de mesa no es válido')

    registros, productos, lineas = _preparar_lineas(datos['items'])
    token = generar_token()

    for intento in range(3):  # reintento si dos pedidos toman el mismo número a la vez
        try:
            with transaction.atomic():
                descuento_pct, cupon = _resolver_cupon(datos.get('cupon'), consumir=True)
                totales = calcular_totales(lineas, descuento_pct, settings.IMPUESTO_PORCENTAJE, propina_pct)
                ultimo = Pedido.objects.aggregate(m=Max('numero'))['m'] or 1000
                pedido = Pedido.objects.create(
                    numero=ultimo + 1, tipo=datos['tipo'], mesa=mesa,
                    cliente=usuario if usuario is not None and usuario.rol == 'CLIENTE' else None,
                    propina_porcentaje=propina_pct, cupon_id=cupon, notas_cocina=(datos.get('notasCocina') or '').strip(),
                    tiempo_estimado_min=estimar_tiempo(productos, lineas), token_seguimiento_hash=sha256(token), **totales,
                )
                PedidoItem.objects.bulk_create([
                    PedidoItem(pedido=pedido, producto=registros[l['producto_slug']], nombre=l['nombre'],
                               precio_unitario=l['precio_unitario'], cantidad=l['cantidad'],
                               personalizacion=l['personalizacion'])
                    for l in lineas
                ])
                EventoPedido.objects.create(pedido=pedido, estado='PENDIENTE', actor=usuario)
            break
        except IntegrityError:
            if intento == 2:
                raise
    serializado = recargar(pedido.id)
    emitir(serializado)
    # El token en claro solo se entrega una vez; el servidor guarda su hash.
    return {'pedido': serializado, 'tokenSeguimiento': token}


# ---------------------------------------------------------------- acceso
def tiene_acceso(pedido: Pedido, token: str | None, usuario) -> bool:
    if es_personal(usuario):
        return True
    if usuario is not None and pedido.cliente_id == usuario.id:
        return True
    return bool(token) and iguales(sha256(token), pedido.token_seguimiento_hash)


def obtener_con_acceso(pedido_id: str, token: str | None, usuario) -> Pedido:
    """
    Personal, cliente dueño o quien presente el token de seguimiento. En otro caso 404, para
    no revelar que el pedido existe (protección contra IDOR, ASVS V8.2).
    """
    pedido = _consulta().filter(id=pedido_id).first()
    if not pedido or not tiene_acceso(pedido, token, usuario):
        raise NoEncontrado('Pedido no encontrado')
    return pedido


# ---------------------------------------------------------------- listados
def listar_activos() -> list:
    """Pedidos en curso más los entregados que aún tienen saldo por cobrar."""
    qs = _consulta().filter(
        Q(estado__in=ESTADOS_ACTIVOS) | Q(estado='ENTREGADO', estado_pago__in=['PENDIENTE', 'PARCIAL'])
    ).order_by('creado_en')
    return [serializar_pedido(p) for p in qs]


def listar(estado, desde, hasta, pagina: int) -> dict:
    qs = _consulta().order_by('-creado_en')
    if estado:
        qs = qs.filter(estado=estado)
    if desde:
        qs = qs.filter(creado_en__gte=desde)
    if hasta:
        qs = qs.filter(creado_en__lte=hasta)
    total = qs.count()
    return {'total': total, 'pagina': pagina,
            'pedidos': [serializar_pedido(p) for p in qs[(pagina - 1) * 50: pagina * 50]]}


def listar_del_cliente(usuario) -> list:
    return [serializar_pedido(p) for p in _consulta().filter(cliente=usuario).order_by('-creado_en')[:50]]


# ---------------------------------------------------------------- estados
def cambiar_estado(pedido_id: str, estado: str, nota: str | None, usuario) -> dict:
    pedido = Pedido.objects.filter(id=pedido_id).first()
    if not pedido:
        raise NoEncontrado('Pedido no encontrado')
    if not puede_transicionar(pedido.estado, estado, usuario.rol):
        raise exceptions.PermissionDenied(f'No puedes pasar el pedido de {pedido.estado} a {estado}')
    if estado == 'CANCELADO':
        return _cancelar(pedido, usuario, nota or 'Cancelado por el restaurante')
    return _aplicar_estado(pedido.id, pedido.estado, estado, usuario, nota)


def cancelar_por_cliente(pedido_id: str, token, usuario) -> dict:
    """El cliente solo puede cancelar mientras el restaurante no lo haya confirmado."""
    pedido = obtener_con_acceso(pedido_id, token, usuario)
    if pedido.estado != 'PENDIENTE':
        raise Conflicto('El pedido ya fue confirmado por el restaurante; pide ayuda al mesero')
    return _cancelar(pedido, usuario, 'Cancelado por el cliente')


def _cancelar(pedido: Pedido, usuario, motivo: str) -> dict:
    from pagos.models import Pago

    aprobados = list(Pago.objects.filter(pedido=pedido, estado='APROBADO'))
    if aprobados and (usuario is None or usuario.rol != 'ADMIN'):
        raise Conflicto('El pedido tiene pagos aprobados: solo un administrador puede cancelarlo')
    with transaction.atomic():
        # Los pagos aprobados quedan marcados para reembolso; los pendientes se anulan.
        Pago.objects.filter(pedido=pedido, estado='APROBADO').update(estado='REEMBOLSO_SOLICITADO')
        Pago.objects.filter(pedido=pedido, estado='PENDIENTE').update(estado='ANULADO')
    if aprobados:
        registrar('pago.reembolso_solicitado', 'Pedido', pedido.id, usuario.id if usuario else None,
                  {'pagos': [p.referencia for p in aprobados]})
    return _aplicar_estado(pedido.id, pedido.estado, 'CANCELADO', usuario, motivo, motivo_cancelacion=motivo)


def _aplicar_estado(pedido_id, desde, hacia, usuario, nota=None, motivo_cancelacion=None) -> dict:
    # Actualización condicionada al estado actual: si dos personas cambian el pedido a la vez,
    # solo una gana (evita saltos de estado por condiciones de carrera).
    cambios = {'estado': hacia, 'actualizado_en': timezone.now()}
    if motivo_cancelacion:
        cambios['motivo_cancelacion'] = motivo_cancelacion
    if Pedido.objects.filter(id=pedido_id, estado=desde).update(**cambios) == 0:
        raise Conflicto('El pedido cambió mientras tanto; actualiza la pantalla')
    actor_id = usuario.id if usuario else None
    EventoPedido.objects.create(pedido_id=pedido_id, estado=hacia, actor_id=actor_id, nota=nota)
    registrar('pedido.estado', 'Pedido', pedido_id, actor_id, {'desde': desde, 'hacia': hacia})
    serializado = recargar(pedido_id)
    emitir(serializado)
    return serializado


# ---------------------------------------------------------------- propina y factura
def cambiar_propina(pedido_id: str, porcentaje: int, token, usuario) -> dict:
    _validar_propina(porcentaje)
    pedido = obtener_con_acceso(pedido_id, token, usuario)
    if pedido.estado == 'CANCELADO':
        raise Conflicto('El pedido está cancelado')
    if any(p.estado in ('APROBADO', 'PENDIENTE') for p in pedido.pagos.all()):
        raise Conflicto('No se puede cambiar la propina con pagos en curso o aprobados')
    base = pedido.subtotal - pedido.descuento
    propina = _redondear(base * porcentaje / 100)
    Pedido.objects.filter(id=pedido_id).update(propina_porcentaje=porcentaje, propina=propina,
                                               total=base + pedido.impuestos + propina, actualizado_en=timezone.now())
    serializado = recargar(pedido_id)
    emitir(serializado)
    return serializado


def guardar_datos_factura(pedido_id: str, datos: dict, token, usuario) -> dict:
    if not datos['aceptaTratamientoDatos']:
        raise SolicitudInvalida('Debes autorizar el tratamiento de tus datos para emitir la factura')
    obtener_con_acceso(pedido_id, token, usuario)
    factura = {k: v for k, v in datos.items() if k != 'aceptaTratamientoDatos'}
    factura['correo'] = factura['correo'].strip().lower()
    factura['autorizacionDatosEn'] = timezone.now().isoformat()
    Pedido.objects.filter(id=pedido_id).update(datos_factura=factura)
    registrar('pedido.factura_solicitada', 'Pedido', pedido_id, usuario.id if usuario else None)
    return {'mensaje': 'Datos de facturación registrados'}
