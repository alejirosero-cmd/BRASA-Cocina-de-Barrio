"""
Pruebas de integración de la API completa (base de datos de pruebas propia, sin servicios externos).
Cubren autenticación, roles, pedidos, meseros, pagos, calificaciones, administración y seguridad.
"""
import os
from urllib.parse import parse_qs, urlparse

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient, APIRequestFactory

from calificaciones.models import Calificacion
from catalogo.models import Categoria, Producto
from cuentas import correo
from cuentas.models import TokenRecuperacion, Usuario
from mesas.models import Mesa
from nucleo.models import RegistroAuditoria
from pagos.models import Pago
from pedidos.models import Cupon, EventoPedido

CLAVE = 'clave-de-prueba-123'
ITEM = {'productoId': 'brasa-original', 'cantidad': 1}
os.environ['BRASA_SIN_LIMITES'] = '1'


@override_settings(ES_PRUEBAS=True, PAGOS_PROVEEDOR='simulado', IMPUESTO_PORCENTAJE=19,
                   PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class BaseApi(TestCase):
    def setUp(self):
        cache.clear()
        self.http = APIClient()
        cat = Categoria.objects.create(slug='hamburguesas', nombre='Hamburguesas')
        Producto.objects.create(
            slug='brasa-original', nombre='Brasa Original', descripcion='x', precio=20000, categoria=cat,
            imagen_url='img/a.jpg', extras=[{'id': 'queso', 'nombre': 'Queso', 'precio': 2500}],
            tamanos=[{'id': 'sencilla', 'nombre': 'Sencilla', 'diferenciaPrecio': 0},
                     {'id': 'doble', 'nombre': 'Doble', 'diferenciaPrecio': 6000}])
        Producto.objects.create(slug='agotado', nombre='Agotado', descripcion='x', precio=1000, categoria=cat,
                                imagen_url='img/a.jpg', disponible=False)
        self.codigo = Mesa.objects.create(numero=4, codigo='MESA4ABC').codigo
        Cupon.objects.create(codigo='BRASA10', porcentaje=10, usos_max=1)
        self.tokens = {}
        for rol in ('ADMIN', 'COCINA', 'MESERO'):
            u = Usuario(email=f'{rol.lower()}@t.co', nombre=rol, rol=rol)
            u.establecer_password(CLAVE)
            u.save()
            self.tokens[rol] = self.login(f'{rol.lower()}@t.co').data['token']

    # ---- utilidades
    def login(self, email, clave=CLAVE):
        return self.http.post('/api/auth/login', {'email': email, 'password': clave}, format='json')

    def auth(self, rol_o_token):
        token = self.tokens.get(rol_o_token, rol_o_token)
        return {'HTTP_AUTHORIZATION': f'Bearer {token}'}

    def tk(self, token):
        return {'HTTP_X_PEDIDO_TOKEN': token}

    def post(self, ruta, datos=None, **extra):
        return self.http.post(ruta, datos or {}, format='json', **extra)

    def patch(self, ruta, datos=None, **extra):
        return self.http.patch(ruta, datos or {}, format='json', **extra)

    def crear_pedido(self, **extra):
        r = self.post('/api/pedidos', {'tipo': 'mesa', 'codigoMesa': self.codigo, 'items': [ITEM], **extra})
        self.assertEqual(r.status_code, 201, r.data)
        return r.data['pedido'], r.data['tokenSeguimiento']

    def entregar(self, pedido_id):
        for rol, estado in [('MESERO', 'CONFIRMADO'), ('COCINA', 'EN_PREPARACION'), ('COCINA', 'LISTO'), ('MESERO', 'ENTREGADO')]:
            self.assertEqual(self.patch(f'/api/pedidos/{pedido_id}/estado', {'estado': estado}, **self.auth(rol)).status_code, 200)

    def cliente(self, email='cliente@t.co'):
        r = self.post('/api/auth/registro', {'email': email, 'nombre': 'Cliente', 'password': CLAVE})
        return r.data['token']


class AutenticacionTest(BaseApi):
    def test_registro_siempre_crea_cliente_y_rechaza_campos_extra(self):
        self.assertEqual(self.post('/api/auth/registro', {'email': 'h@t.co', 'nombre': 'H', 'password': CLAVE, 'rol': 'ADMIN'}).status_code, 400)
        r = self.post('/api/auth/registro', {'email': 'Cliente@T.co', 'nombre': 'Cliente', 'password': CLAVE})
        self.assertEqual(r.status_code, 201)
        self.assertEqual((r.data['usuario']['email'], r.data['usuario']['rol']), ('cliente@t.co', 'CLIENTE'))
        self.assertNotIn('password_hash', r.data['usuario'])

    def test_correo_duplicado_y_contrasena_corta(self):
        self.cliente()
        self.assertEqual(self.post('/api/auth/registro', {'email': 'cliente@t.co', 'nombre': 'Otra', 'password': CLAVE}).status_code, 409)
        self.assertEqual(self.post('/api/auth/registro', {'email': 'c@t.co', 'nombre': 'C', 'password': '123'}).status_code, 400)

    def test_mismo_mensaje_si_el_correo_no_existe_o_la_clave_es_incorrecta(self):
        a, b = self.login('noexiste@t.co'), self.login('admin@t.co', 'incorrecta-123')
        self.assertEqual((a.status_code, b.status_code), (401, 401))
        self.assertEqual(a.data['message'], b.data['message'])

    def test_la_contrasena_nunca_se_guarda_en_claro(self):
        self.cliente()
        self.assertNotIn(CLAVE, Usuario.objects.get(email='cliente@t.co').password_hash)

    def test_tokens_manipulados_o_ausentes(self):
        self.assertEqual(self.http.get('/api/auth/perfil', **self.auth(self.tokens['ADMIN'] + 'x')).status_code, 401)
        self.assertEqual(self.http.get('/api/auth/perfil').status_code, 401)

    def test_recuperacion_de_un_solo_uso_que_cierra_sesiones(self):
        sesion = self.cliente('olvido@t.co')
        correo.BUZON_PRUEBAS.clear()
        inexistente = self.post('/api/auth/recuperar', {'email': 'nadie@t.co'})
        existente = self.post('/api/auth/recuperar', {'email': 'olvido@t.co'})
        self.assertEqual((inexistente.status_code, existente.data), (202, inexistente.data))  # no enumera cuentas
        token = parse_qs(urlparse(correo.BUZON_PRUEBAS[-1][1]).query)['token'][0]
        self.assertFalse(TokenRecuperacion.objects.filter(token_hash=token).exists())  # se guarda solo el hash
        self.assertEqual(self.post('/api/auth/restablecer', {'token': token, 'password': 'nueva-clave-segura'}).status_code, 200)
        self.assertEqual(self.post('/api/auth/restablecer', {'token': token, 'password': 'otra-clave-segura'}).status_code, 400)
        self.assertEqual(self.http.get('/api/auth/perfil', **self.auth(sesion)).status_code, 401)
        self.assertEqual(self.login('olvido@t.co', 'nueva-clave-segura').status_code, 200)


class RolesTest(BaseApi):
    def test_rutas_solo_para_administrador(self):
        cliente = self.cliente()
        for metodo, ruta in [('get', '/api/usuarios'), ('get', '/api/reportes/resumen'), ('get', '/api/pagos'),
                             ('post', '/api/productos'), ('post', '/api/mesas')]:
            llamar = (lambda **h: self.http.get(ruta, **h)) if metodo == 'get' else (lambda **h: self.post(ruta, {}, **h))
            with self.subTest(ruta=ruta):
                self.assertEqual(llamar().status_code, 401)
                self.assertEqual(llamar(**self.auth(cliente)).status_code, 403)
                self.assertEqual(llamar(**self.auth('COCINA')).status_code, 403)
                self.assertEqual(llamar(**self.auth('MESERO')).status_code, 403)

    def test_paneles_del_personal(self):
        cliente = self.cliente()
        self.assertEqual(self.http.get('/api/pedidos/activos', **self.auth(cliente)).status_code, 403)
        self.assertEqual(self.http.get('/api/pedidos/activos', **self.auth('COCINA')).status_code, 200)
        self.assertEqual(self.http.get('/api/solicitudes', **self.auth('COCINA')).status_code, 403)
        self.assertEqual(self.http.get('/api/solicitudes', **self.auth('MESERO')).status_code, 200)

    def test_cambiar_el_rol_invalida_las_sesiones(self):
        r = self.post('/api/usuarios', {'email': 'temp@t.co', 'nombre': 'Temp', 'password': CLAVE, 'rol': 'MESERO'}, **self.auth('ADMIN'))
        sesion = self.login('temp@t.co').data['token']
        self.assertEqual(self.http.get('/api/solicitudes', **self.auth(sesion)).status_code, 200)
        self.assertEqual(self.patch(f'/api/usuarios/{r.data["id"]}', {'rol': 'CLIENTE'}, **self.auth('ADMIN')).status_code, 200)
        self.assertEqual(self.http.get('/api/solicitudes', **self.auth(sesion)).status_code, 401)

    def test_el_administrador_no_puede_quitarse_su_rol(self):
        yo = self.http.get('/api/auth/perfil', **self.auth('ADMIN')).data
        self.assertEqual(self.patch(f'/api/usuarios/{yo["id"]}', {'rol': 'CLIENTE'}, **self.auth('ADMIN')).status_code, 400)


class PedidosTest(BaseApi):
    def test_precio_calculado_por_el_servidor(self):
        self.assertEqual(self.post('/api/pedidos', {'tipo': 'mesa', 'codigoMesa': self.codigo,
                                                    'items': [{**ITEM, 'precioUnitario': 1}]}).status_code, 400)
        pedido, _ = self.crear_pedido(items=[{'productoId': 'brasa-original', 'cantidad': 2, 'tamanoId': 'doble', 'extras': ['queso']}],
                                      propinaPorcentaje=10)
        sub = (20000 + 6000 + 2500) * 2
        self.assertEqual(pedido['resumen'], {'subtotal': sub, 'descuento': 0, 'impuestos': round(sub * 0.19),
                                             'propina': sub // 10, 'total': sub + round(sub * 0.19) + sub // 10})
        self.assertEqual(pedido['estado'], 'PENDIENTE')

    def test_mesa_por_codigo_valido(self):
        self.assertEqual(self.post('/api/pedidos', {'tipo': 'mesa', 'items': [ITEM]}).status_code, 400)
        self.assertEqual(self.post('/api/pedidos', {'tipo': 'mesa', 'codigoMesa': 'NOEXISTE1', 'items': [ITEM]}).status_code, 400)
        self.assertEqual(self.post('/api/pedidos', {'tipo': 'llevar', 'items': [ITEM]}).status_code, 201)

    def test_productos_agotados_inexistentes_y_pedido_vacio(self):
        for items in ([{'productoId': 'agotado', 'cantidad': 1}], [{'productoId': 'fantasma', 'cantidad': 1}], []):
            with self.subTest(items=items):
                self.assertEqual(self.post('/api/pedidos', {'tipo': 'llevar', 'items': items}).status_code, 400)

    def test_cotizar_no_consume_el_cupon(self):
        r = self.post('/api/pedidos/cotizar', {'items': [ITEM], 'cupon': 'BRASA10', 'propinaPorcentaje': 10})
        self.assertEqual(r.status_code, 200)
        self.assertEqual({k: r.data[k] for k in ('subtotal', 'descuento', 'impuestos', 'propina', 'total', 'cupon')},
                         {'subtotal': 20000, 'descuento': 2000, 'impuestos': 3420, 'propina': 1800, 'total': 23220, 'cupon': 'BRASA10'})
        self.assertEqual(Cupon.objects.get(codigo='BRASA10').usos, 0)
        self.assertEqual(self.post('/api/pedidos/cotizar', {'items': [ITEM], 'cupon': 'NOEXISTE'}).status_code, 400)

    def test_cupon_con_limite_de_usos(self):
        pedido, _ = self.crear_pedido(cupon='brasa10')
        self.assertEqual(pedido['resumen']['total'], 18000 + round(18000 * 0.19))
        self.assertEqual(self.post('/api/pedidos', {'tipo': 'llevar', 'items': [ITEM], 'cupon': 'BRASA10'}).status_code, 400)
        self.assertEqual(self.post('/api/pedidos', {'tipo': 'llevar', 'items': [ITEM], 'cupon': 'INVENTADO'}).status_code, 400)

    def test_solo_el_dueno_del_token_o_el_personal_ve_el_pedido(self):
        pedido, token = self.crear_pedido()
        ruta = f'/api/pedidos/{pedido["id"]}'
        self.assertEqual(self.http.get(ruta).status_code, 404)
        self.assertEqual(self.http.get(ruta, **self.tk('token-falso')).status_code, 404)
        self.assertEqual(self.http.get(ruta, **self.auth(self.cliente())).status_code, 404)
        self.assertEqual(self.http.get(ruta, **self.tk(token)).status_code, 200)
        self.assertEqual(self.http.get(ruta, **self.auth('MESERO')).status_code, 200)

    def test_flujo_completo_respetando_roles(self):
        pedido, _ = self.crear_pedido()
        paso = lambda rol, estado: self.patch(f'/api/pedidos/{pedido["id"]}/estado', {'estado': estado}, **self.auth(rol)).status_code
        self.assertEqual(paso('COCINA', 'LISTO'), 403)
        self.assertEqual(paso('MESERO', 'CONFIRMADO'), 200)
        self.assertEqual(paso('MESERO', 'EN_PREPARACION'), 403)
        self.assertEqual(paso('COCINA', 'EN_PREPARACION'), 200)
        self.assertEqual(paso('COCINA', 'LISTO'), 200)
        self.assertEqual(paso('COCINA', 'ENTREGADO'), 403)
        self.assertEqual(paso('MESERO', 'ENTREGADO'), 200)
        self.assertEqual(paso('ADMIN', 'CANCELADO'), 403)
        activos = self.http.get('/api/pedidos/activos', **self.auth('MESERO')).data
        self.assertIn(pedido['id'], [p['id'] for p in activos])  # entregado sin pagar: sigue por cobrar
        self.assertEqual(list(EventoPedido.objects.filter(pedido_id=pedido['id']).values_list('estado', flat=True)),
                         ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'])

    def test_el_cliente_cancela_solo_mientras_esta_pendiente(self):
        a, ta = self.crear_pedido()
        self.assertEqual(self.post(f'/api/pedidos/{a["id"]}/cancelar', **self.tk(ta)).status_code, 201)
        b, tb = self.crear_pedido()
        self.patch(f'/api/pedidos/{b["id"]}/estado', {'estado': 'CONFIRMADO'}, **self.auth('MESERO'))
        self.assertEqual(self.post(f'/api/pedidos/{b["id"]}/cancelar', **self.tk(tb)).status_code, 409)

    def test_historial_del_cliente_con_sesion(self):
        cliente = self.cliente()
        r = self.post('/api/pedidos', {'tipo': 'llevar', 'items': [ITEM]}, **self.auth(cliente))
        mios = self.http.get('/api/pedidos/mios', **self.auth(cliente)).data
        self.assertIn(r.data['pedido']['id'], [p['id'] for p in mios])


class MeserosTest(BaseApi):
    def test_solicitud_sin_duplicados_y_atencion_unica(self):
        a = self.post('/api/solicitudes', {'motivo': 'cuenta', 'codigoMesa': self.codigo})
        b = self.post('/api/solicitudes', {'motivo': 'cuenta', 'codigoMesa': self.codigo})
        self.assertEqual((b.data['id'], b.data['repetida']), (a.data['id'], True))
        self.assertEqual(self.patch(f'/api/solicitudes/{a.data["id"]}/atender', **self.auth('MESERO')).status_code, 200)
        self.assertEqual(self.patch(f'/api/solicitudes/{a.data["id"]}/atender', **self.auth('MESERO')).status_code, 409)
        self.assertEqual(self.post('/api/solicitudes', {'motivo': 'ayuda'}).status_code, 400)


class PagosTest(BaseApi):
    def test_pagos_divididos_idempotentes_y_sin_pagar_de_mas(self):
        pedido, token = self.crear_pedido()
        total, t = pedido['resumen']['total'], self.tk(token)
        self.assertEqual(self.post('/api/pagos', {'pedidoId': pedido['id']}).status_code, 404)
        self.assertEqual(self.post('/api/pagos', {'pedidoId': pedido['id'], 'monto': total + 1}, **t).status_code, 400)
        parte1 = self.post('/api/pagos', {'pedidoId': pedido['id'], 'monto': 10000}, **t)
        repetido = self.post('/api/pagos', {'pedidoId': pedido['id'], 'monto': 10000}, **t)
        self.assertEqual(repetido.data['pago']['referencia'], parte1.data['pago']['referencia'])  # doble clic
        ref = parte1.data['pago']['referencia']
        self.assertEqual(self.post(f'/api/pagos/simulado/{ref}', {'aprobar': True}).data['resultado'], 'aplicado')
        self.assertEqual(self.post(f'/api/pagos/simulado/{ref}', {'aprobar': True}).data['resultado'], 'duplicado')
        estado = self.http.get(f'/api/pedidos/{pedido["id"]}', **t).data
        self.assertEqual((estado['estadoPago'], estado['pagado'], estado['saldo']), ('PARCIAL', 10000, total - 10000))
        parte2 = self.post('/api/pagos', {'pedidoId': pedido['id']}, **t)
        self.assertEqual(parte2.data['pago']['monto'], total - 10000)
        self.post(f'/api/pagos/simulado/{parte2.data["pago"]["referencia"]}', {'aprobar': True})
        estado = self.http.get(f'/api/pedidos/{pedido["id"]}', **t).data
        self.assertEqual((estado['estadoPago'], estado['saldo']), ('PAGADO', 0))
        self.assertEqual(self.post('/api/pagos', {'pedidoId': pedido['id']}, **t).status_code, 409)

    def test_un_pago_rechazado_no_se_aprueba_despues(self):
        pedido, token = self.crear_pedido()
        p = self.post('/api/pagos', {'pedidoId': pedido['id']}, **self.tk(token)).data['pago']
        self.post(f'/api/pagos/simulado/{p["referencia"]}', {'aprobar': False})
        self.assertEqual(self.post(f'/api/pagos/simulado/{p["referencia"]}', {'aprobar': True}).data['resultado'], 'ignorado')
        self.assertEqual(self.http.get(f'/api/pedidos/{pedido["id"]}', **self.tk(token)).data['estadoPago'], 'PENDIENTE')

    def test_webhook_wompi_inexistente_con_simulador(self):
        self.assertEqual(self.post('/api/pagos/webhook/wompi', {}).status_code, 404)

    def test_efectivo_solo_lo_registra_el_personal(self):
        pedido, _ = self.crear_pedido()
        self.assertEqual(self.post('/api/pagos/efectivo', {'pedidoId': pedido['id']}, **self.auth(self.cliente())).status_code, 403)
        self.assertEqual(self.post('/api/pagos/efectivo', {'pedidoId': pedido['id']}, **self.auth('MESERO')).status_code, 201)
        self.assertEqual(self.http.get(f'/api/pedidos/{pedido["id"]}', **self.auth('MESERO')).data['estadoPago'], 'PAGADO')

    def test_cancelar_pedido_pagado_deja_reembolso_pendiente(self):
        pedido, _ = self.crear_pedido()
        self.post('/api/pagos/efectivo', {'pedidoId': pedido['id']}, **self.auth('MESERO'))
        ruta = f'/api/pedidos/{pedido["id"]}/estado'
        self.assertEqual(self.patch(ruta, {'estado': 'CANCELADO'}, **self.auth('MESERO')).status_code, 409)
        self.assertEqual(self.patch(ruta, {'estado': 'CANCELADO'}, **self.auth('ADMIN')).status_code, 200)
        pagos = Pago.objects.filter(pedido_id=pedido['id'])
        self.assertTrue(all(p.estado == 'REEMBOLSO_SOLICITADO' for p in pagos))
        self.assertEqual(self.patch(f'/api/pagos/{pagos[0].id}/reembolsado', **self.auth('ADMIN')).status_code, 200)


class CalificacionesTest(BaseApi):
    def test_solo_entregados_una_vez_y_de_1_a_5(self):
        pedido, token = self.crear_pedido()
        calificar = lambda n: self.post('/api/calificaciones', {'pedidoId': pedido['id'], 'estrellas': n,
                                                               'comentario': '  Muy rico  '}, **self.tk(token))
        self.assertEqual(calificar(5).status_code, 409)  # aún no entregado
        self.entregar(pedido['id'])
        self.assertEqual(calificar(0).status_code, 400)
        self.assertEqual(calificar(6).status_code, 400)
        ok = calificar(4)
        self.assertEqual((ok.status_code, ok.data['comentario']), (201, 'Muy rico'))
        self.assertEqual(calificar(5).status_code, 409)  # duplicada
        self.assertEqual(self.post('/api/calificaciones', {'pedidoId': pedido['id'], 'estrellas': 5}).status_code, 404)
        resumen = self.http.get('/api/calificaciones/resumen').data
        self.assertEqual((resumen['total'], resumen['promedio']), (1, 4))
        self.assertEqual(Calificacion.objects.count(), 1)


class AdministracionTest(BaseApi):
    def test_gestiona_productos_y_valida(self):
        producto = {'id': 'nueva-burger', 'nombre': 'Nueva', 'descripcion': 'd', 'precio': 15000, 'categoria': 'hamburguesas',
                    'imagenUrl': 'img/x.jpg', 'etiquetas': [], 'ingredientes': [], 'tamanos': [], 'extras': [],
                    'salsas': [], 'retirables': [], 'tiempoPreparacionMin': 10}
        a = self.auth('ADMIN')
        self.assertEqual(self.post('/api/productos', {**producto, 'precio': -5}, **a).status_code, 400)
        self.assertEqual(self.post('/api/productos', {**producto, 'imagenUrl': 'javascript:alert(1)'}, **a).status_code, 400)
        self.assertEqual(self.post('/api/productos', producto, **a).status_code, 201)
        self.assertEqual(self.patch('/api/productos/nueva-burger/disponibilidad', {'disponible': False}, **self.auth('COCINA')).status_code, 200)
        self.assertNotIn('nueva-burger', [p['id'] for p in self.http.get('/api/productos').data])
        self.assertEqual(self.post('/api/productos/categorias', {'id': 'bebidas', 'nombre': 'Bebidas', 'orden': 3}, **a).status_code, 201)

    def test_mesas_qr_y_regeneracion(self):
        a = self.auth('ADMIN')
        mesa = self.post('/api/mesas', {'numero': 20}, **a).data
        self.assertEqual(self.post('/api/mesas', {'numero': 20}, **a).status_code, 409)
        qr = self.http.get(f'/api/mesas/{mesa["id"]}/qr.svg', **a)
        self.assertEqual((qr.status_code, qr['Content-Type']), (200, 'image/svg+xml'))
        self.assertIn(b'<svg', qr.content)
        self.assertEqual(self.http.get(f'/api/mesas/codigo/{mesa["codigo"]}').status_code, 200)
        self.assertEqual(self.post(f'/api/mesas/{mesa["id"]}/regenerar-codigo', **a).status_code, 201)
        self.assertEqual(self.http.get(f'/api/mesas/codigo/{mesa["codigo"]}').status_code, 404)

    def test_mesa_por_numero(self):
        mesa = self.post('/api/mesas', {'numero': 7}, **self.auth('ADMIN')).data
        for escrito in ('7', '07', '007'):
            r = self.http.get(f'/api/mesas/codigo/{escrito}')
            self.assertEqual((r.status_code, r.data['numero'], r.data['codigo']), (200, 7, mesa['codigo']))
        self.assertEqual(self.http.get('/api/mesas/codigo/99').status_code, 404)

    def test_reportes_y_auditoria(self):
        pedido, _ = self.crear_pedido()
        self.post('/api/pagos/efectivo', {'pedidoId': pedido['id']}, **self.auth('MESERO'))
        self.login('admin@t.co', 'incorrecta-123')
        r = self.http.get('/api/reportes/resumen', **self.auth('ADMIN')).data
        self.assertGreater(r['ventasTotales'], 0)
        self.assertEqual(r['masVendidos'][0]['nombre'], 'Brasa Original')
        acciones = set(RegistroAuditoria.objects.values_list('accion', flat=True))
        self.assertTrue({'sesion.inicio', 'sesion.fallida', 'pago.efectivo'} <= acciones)


class TiempoRealTest(BaseApi):
    """
    Las vistas SSE se llaman directamente (APIRequestFactory): el cliente de pruebas de Django cierra
    la conexión a la base de datos al terminar un flujo, lo que en PostgreSQL rompería la transacción
    de la prueba. En producción ese cierre es el comportamiento correcto.
    """

    def abrir(self, vista, *args, **cabeceras):
        peticion = APIRequestFactory().get('/', HTTP_ACCEPT='text/event-stream', **cabeceras)
        return vista.as_view()(peticion, *args)

    def test_canales_sse_aceptan_event_stream_y_respetan_permisos(self):
        from pedidos import views

        r = self.abrir(views.EventosPersonalVista, **self.auth('COCINA'))
        self.assertEqual((r.status_code, r['Content-Type']), (200, 'text/event-stream'))
        self.assertEqual(next(iter(r.streaming_content)), b': conectado\n\n')
        self.assertEqual(self.abrir(views.EventosPersonalVista).status_code, 401)
        self.assertEqual(self.abrir(views.EventosPersonalVista, **self.auth(self.cliente())).status_code, 403)

        pedido, token = self.crear_pedido()
        self.assertEqual(self.abrir(views.EventosPedidoVista, pedido['id']).status_code, 404)
        propio = self.abrir(views.EventosPedidoVista, pedido['id'], **self.tk(token))
        self.assertEqual((propio.status_code, propio['Content-Type']), (200, 'text/event-stream'))


class SeguridadTest(BaseApi):
    def test_cabeceras_y_cors_restringido(self):
        r = self.http.get('/api/productos', HTTP_ORIGIN='http://localhost:4200')
        self.assertEqual(r['X-Content-Type-Options'], 'nosniff')
        self.assertEqual(r['Access-Control-Allow-Origin'], 'http://localhost:4200')
        otro = self.http.get('/api/productos', HTTP_ORIGIN='https://sitio-malicioso.com')
        self.assertNotIn('Access-Control-Allow-Origin', otro)

    def test_limite_de_intentos_de_inicio_de_sesion(self):
        os.environ['BRASA_SIN_LIMITES'] = '0'
        cache.clear()
        try:
            codigos = [self.login('x@t.co', 'incorrecta-1').status_code for _ in range(7)]
        finally:
            os.environ['BRASA_SIN_LIMITES'] = '1'
        self.assertIn(429, codigos)

    def test_no_se_puede_saltar_el_limite_falsificando_la_ip(self):
        os.environ['BRASA_SIN_LIMITES'] = '0'
        cache.clear()
        try:
            codigos = [self.http.post('/api/auth/login', {'email': 'x@t.co', 'password': 'incorrecta-1'}, format='json',
                                      HTTP_X_FORWARDED_FOR=f'10.0.0.{i}').status_code for i in range(7)]
        finally:
            os.environ['BRASA_SIN_LIMITES'] = '1'
        self.assertIn(429, codigos)
