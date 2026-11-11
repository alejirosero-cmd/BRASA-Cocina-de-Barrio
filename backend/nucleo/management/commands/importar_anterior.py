"""
Importa los datos de la versión anterior (NestJS + Prisma, archivo server/prisma/dev.db):
usuarios con sus contraseñas, mesas con sus mismos códigos QR, menú, cupones, pedidos, pagos,
llamados al mesero y calificaciones. No modifica la base anterior y solo importa lo que falte.

    python manage.py importar_anterior ../server/prisma/dev.db
"""
import json
import sqlite3
from datetime import datetime, timezone

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from calificaciones.models import Calificacion
from catalogo.models import Categoria, Producto
from cuentas.models import Usuario
from mesas.models import Mesa
from pagos.models import EventoPago, Pago
from pedidos.models import Cupon, EventoPedido, Pedido, PedidoItem
from solicitudes.models import SolicitudMesero


def fecha(ms):
    if ms is None:
        return None
    if isinstance(ms, (int, float)):
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return datetime.fromisoformat(str(ms).replace('Z', '+00:00'))


def j(texto, por_defecto):
    try:
        return json.loads(texto) if texto else por_defecto
    except ValueError:
        return por_defecto


class Command(BaseCommand):
    help = 'Importa los datos de la base SQLite de la versión anterior (Prisma).'

    def add_arguments(self, parser):
        parser.add_argument('ruta', help='Ruta al archivo dev.db de la versión anterior')

    def handle(self, ruta, **opciones):
        try:
            origen = sqlite3.connect(f'file:{ruta}?mode=ro', uri=True)  # solo lectura
        except sqlite3.Error as e:
            raise CommandError(f'No se pudo abrir {ruta}: {e}') from e
        origen.row_factory = sqlite3.Row
        filas = lambda tabla: list(origen.execute(f'SELECT * FROM "{tabla}"'))
        cuenta = {}

        with transaction.atomic():
            for r in filas('Usuario'):
                if not Usuario.objects.filter(email=r['email']).exists():
                    # Django reconoce los hash bcrypt con el prefijo "bcrypt$": las contraseñas siguen sirviendo.
                    Usuario.objects.create(id=r['id'], email=r['email'], nombre=r['nombre'], rol=r['rol'],
                                           activo=bool(r['activo']), version_sesion=r['versionSesion'],
                                           password_hash=f'bcrypt${r["passwordHash"]}')
                    cuenta['usuarios'] = cuenta.get('usuarios', 0) + 1
            categorias = {}
            for r in filas('Categoria'):
                c, _ = Categoria.objects.get_or_create(slug=r['slug'], defaults={
                    'id': r['id'], 'nombre': r['nombre'], 'orden': r['orden'], 'activa': bool(r['activa'])})
                categorias[r['id']] = c
            productos = {}
            for r in filas('Producto'):
                p, creado = Producto.objects.get_or_create(slug=r['slug'], defaults={
                    'id': r['id'], 'nombre': r['nombre'], 'descripcion': r['descripcion'], 'precio': r['precio'],
                    'categoria': categorias[r['categoriaId']], 'imagen_url': r['imagenUrl'],
                    'etiquetas': j(r['etiquetas'], []), 'ingredientes': j(r['ingredientes'], []),
                    'tamanos': j(r['tamanos'], []), 'extras': j(r['extras'], []), 'salsas': j(r['salsas'], []),
                    'retirables': j(r['retirables'], []), 'tiempo_preparacion_min': r['tiempoPreparacionMin'],
                    'disponible': bool(r['disponible'])})
                productos[r['id']] = p
            mesas = {}
            for r in filas('Mesa'):
                # Se conserva el mismo código: los QR ya impresos siguen funcionando.
                m = Mesa.objects.filter(numero=r['numero']).first()
                if m is None:
                    m = Mesa.objects.create(id=r['id'], numero=r['numero'], codigo=r['codigo'], activa=bool(r['activa']))
                elif m.codigo != r['codigo']:
                    m.codigo = r['codigo']
                    m.save(update_fields=['codigo'])
                mesas[r['id']] = m
            for r in filas('Cupon'):
                Cupon.objects.update_or_create(codigo=r['codigo'], defaults={
                    'porcentaje': r['porcentaje'], 'activo': bool(r['activo']), 'usos_max': r['usosMax'],
                    'usos': r['usos'], 'vence_en': fecha(r['venceEn'])})

            usuarios = {u.id: u for u in Usuario.objects.all()}
            for r in filas('Pedido'):
                if Pedido.objects.filter(id=r['id']).exists() or Pedido.objects.filter(numero=r['numero']).exists():
                    continue
                Pedido.objects.create(
                    id=r['id'], numero=r['numero'], tipo=r['tipo'], mesa=mesas.get(r['mesaId']),
                    cliente=usuarios.get(r['clienteId']), estado=r['estado'], estado_pago=r['estadoPago'],
                    subtotal=r['subtotal'], descuento=r['descuento'], impuestos=r['impuestos'],
                    propina_porcentaje=r['propinaPorcentaje'], propina=r['propina'], total=r['total'],
                    cupon_id=r['cuponCodigo'], notas_cocina=r['notasCocina'] or '',
                    tiempo_estimado_min=r['tiempoEstimadoMin'], token_seguimiento_hash=r['tokenSeguimientoHash'],
                    datos_factura=j(r['datosFactura'], None), motivo_cancelacion=r['motivoCancelacion'])
                cuenta['pedidos'] = cuenta.get('pedidos', 0) + 1
            for r in filas('PedidoItem'):
                if not PedidoItem.objects.filter(id=r['id']).exists() and Pedido.objects.filter(id=r['pedidoId']).exists():
                    PedidoItem.objects.create(id=r['id'], pedido_id=r['pedidoId'], producto=productos[r['productoId']],
                                              nombre=r['nombre'], precio_unitario=r['precioUnitario'],
                                              cantidad=r['cantidad'], personalizacion=j(r['personalizacion'], {}))
            for r in filas('EventoPedido'):
                if not EventoPedido.objects.filter(id=r['id']).exists() and Pedido.objects.filter(id=r['pedidoId']).exists():
                    EventoPedido.objects.create(id=r['id'], pedido_id=r['pedidoId'], estado=r['estado'],
                                                actor=usuarios.get(r['actorId']), nota=r['nota'])
            for r in filas('Pago'):
                if not Pago.objects.filter(referencia=r['referencia']).exists():
                    Pago.objects.create(id=r['id'], pedido_id=r['pedidoId'], proveedor=r['proveedor'],
                                        referencia=r['referencia'], monto=r['monto'], moneda=r['moneda'],
                                        estado=r['estado'], transaccion_proveedor_id=r['transaccionProveedorId'],
                                        metodo=r['metodo'], registrado_por=usuarios.get(r['registradoPorId']))
                    cuenta['pagos'] = cuenta.get('pagos', 0) + 1
            for r in filas('EventoPago'):
                if not EventoPago.objects.filter(clave_idempotencia=r['claveIdempotencia']).exists():
                    EventoPago.objects.create(id=r['id'], pago=Pago.objects.filter(id=r['pagoId']).first(),
                                              clave_idempotencia=r['claveIdempotencia'], tipo=r['tipo'],
                                              estado_reportado=r['estadoReportado'], firma_valida=bool(r['firmaValida']),
                                              payload=r['payload'])
            for r in filas('SolicitudMesero'):
                if not SolicitudMesero.objects.filter(id=r['id']).exists():
                    SolicitudMesero.objects.create(id=r['id'], mesa=mesas.get(r['mesaId']), motivo=r['motivo'],
                                                   estado=r['estado'], atendida_por=usuarios.get(r['atendidaPorId']),
                                                   atendida_en=fecha(r['atendidaEn']))
            for r in filas('Calificacion'):
                if not Calificacion.objects.filter(pedido_id=r['pedidoId']).exists():
                    Calificacion.objects.create(id=r['id'], pedido_id=r['pedidoId'], estrellas=r['estrellas'],
                                                comentario=r['comentario'] or '')
                    cuenta['calificaciones'] = cuenta.get('calificaciones', 0) + 1

            # Se conservan las fechas originales (auto_now_add las habría puesto en "ahora").
            for modelo, tabla, campo in [(Pedido, 'Pedido', 'creado_en'), (Pago, 'Pago', 'creado_en'),
                                         (Usuario, 'Usuario', 'creado_en'), (SolicitudMesero, 'SolicitudMesero', 'creado_en'),
                                         (Calificacion, 'Calificacion', 'creado_en'), (EventoPedido, 'EventoPedido', 'creado_en')]:
                for r in filas(tabla):
                    modelo.objects.filter(id=r['id']).update(**{campo: fecha(r['creadoEn'])})
        origen.close()
        self.stdout.write(self.style.SUCCESS(f'Importado: {cuenta or "nada nuevo"}'))
