"""
Cálculo de precios del pedido. Funciones puras: nunca se confía en un precio enviado por el
cliente; todo se recalcula a partir del catálogo guardado en la base de datos.
"""
from dataclasses import dataclass, field

CANTIDAD_MAX_POR_ITEM = 20
ITEMS_MAX_POR_PEDIDO = 30


class ErrorDePedido(Exception):
    pass


@dataclass
class ProductoParaPrecio:
    slug: str
    nombre: str
    precio: int
    disponible: bool
    tiempo_preparacion_min: int
    tamanos: list = field(default_factory=list)
    extras: list = field(default_factory=list)
    salsas: list = field(default_factory=list)
    retirables: list = field(default_factory=list)


def _elegir(disponibles: list, ids, grupo: str, producto: str) -> list:
    elegidos = []
    for id_ in dict.fromkeys(ids or []):  # sin repetidos, conservando el orden
        opcion = next((o for o in disponibles if o['id'] == id_), None)
        if opcion is None:
            raise ErrorDePedido(f'La opción "{id_}" no existe en {grupo} de {producto}')
        elegidos.append(opcion)
    return elegidos


def calcular_linea(producto: ProductoParaPrecio, item: dict) -> dict:
    if not producto.disponible:
        raise ErrorDePedido(f'{producto.nombre} no está disponible en este momento')
    cantidad = item.get('cantidad')
    if not isinstance(cantidad, int) or isinstance(cantidad, bool) or not 1 <= cantidad <= CANTIDAD_MAX_POR_ITEM:
        raise ErrorDePedido(f'La cantidad de {producto.nombre} debe estar entre 1 y {CANTIDAD_MAX_POR_ITEM}')

    tamano = None
    tamano_id = item.get('tamanoId')
    if producto.tamanos:
        tamano = next((t for t in producto.tamanos if t['id'] == tamano_id), None) if tamano_id else producto.tamanos[0]
        if tamano is None:
            raise ErrorDePedido(f'El tamaño "{tamano_id}" no existe para {producto.nombre}')
    elif tamano_id:
        raise ErrorDePedido(f'{producto.nombre} no tiene tamaños')

    extras = _elegir(producto.extras, item.get('extras'), 'los extras', producto.nombre)
    salsas = _elegir(producto.salsas, item.get('salsas'), 'las salsas', producto.nombre)
    retirados = []
    for valor in dict.fromkeys(item.get('retirados') or []):
        r = next((x for x in producto.retirables if valor in (x['id'], x['nombre'])), None)
        if r is None:
            raise ErrorDePedido(f'"{valor}" no se puede retirar de {producto.nombre}')
        retirados.append(r['nombre'])

    precio_unitario = (
        producto.precio
        + (tamano['diferenciaPrecio'] if tamano else 0)
        + sum(e['precio'] for e in extras)
        + sum(s['precio'] for s in salsas)
    )
    if precio_unitario < 0:
        raise ErrorDePedido(f'Precio inválido para {producto.nombre}')

    personalizacion = {'extras': extras, 'salsas': salsas, 'retirados': retirados,
                       'instrucciones': (item.get('instrucciones') or '').strip()}
    if tamano:
        personalizacion['tamano'] = tamano
    return {'producto_slug': producto.slug, 'nombre': producto.nombre, 'precio_unitario': precio_unitario,
            'cantidad': cantidad, 'personalizacion': personalizacion}


def _redondear(x: float) -> int:
    """Redondeo "half up" como Math.round de JavaScript (round() de Python redondea al par)."""
    import math

    return math.floor(x + 0.5)


def calcular_totales(lineas: list, descuento_pct: int, impuesto_pct: int, propina_pct: int) -> dict:
    """base = subtotal − descuento; impuestos y propina se calculan sobre la base."""
    subtotal = sum(l['precio_unitario'] * l['cantidad'] for l in lineas)
    descuento = _redondear(subtotal * descuento_pct / 100)
    base = subtotal - descuento
    impuestos = _redondear(base * impuesto_pct / 100)
    propina = _redondear(base * propina_pct / 100)
    return {'subtotal': subtotal, 'descuento': descuento, 'impuestos': impuestos, 'propina': propina,
            'total': base + impuestos + propina}


def estimar_tiempo(productos: list, lineas: list) -> int:
    """El plato más demorado más 2 minutos por cada unidad adicional (máximo 90)."""
    maximo = max(next((p.tiempo_preparacion_min for p in productos if p.slug == l['producto_slug']), 15) for l in lineas)
    unidades = sum(l['cantidad'] for l in lineas)
    return min(90, maximo + 2 * (unidades - 1))
