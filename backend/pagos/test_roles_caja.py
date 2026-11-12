"""
Cada rol hace solo lo suyo, y los cobros en la mesa quedan trazados y protegidos:
- la cocina no toma pedidos ni cobra; el mesero toma pedidos y cobra solo con permiso;
- el personal no hace por el cliente lo que es del cliente (pagar en línea, propina, calificar...);
- un cobro guarda quién, cuándo, cómo y cuánto; no se duplica ni excede el saldo;
- con datáfono se exige el código de aprobación; solo el administrador anula y cierra la caja.
"""
import uuid

from cuentas.models import Usuario
from nucleo.test_api import BaseApi
from pagos.models import CierreCaja, Pago


class RolesTest(BaseApi):
    def test_cocina_no_toma_pedidos_y_el_mesero_si(self):
        datos = {'tipo': 'mesa', 'codigoMesa': self.codigo, 'items': [{'productoId': 'brasa-original', 'cantidad': 1}]}
        self.assertEqual(self.post('/api/pedidos', datos, **self.auth('COCINA')).status_code, 403)
        self.assertEqual(self.post('/api/pedidos', datos, **self.auth('MESERO')).status_code, 201)

    def test_la_cocina_no_entrega_ni_cancela(self):
        pedido, _ = self.crear_pedido()
        ruta = f'/api/pedidos/{pedido["id"]}/estado'
        self.assertEqual(self.patch(ruta, {'estado': 'CANCELADO'}, **self.auth('COCINA')).status_code, 403)
        for estado in ('CONFIRMADO', 'EN_PREPARACION', 'LISTO'):
            self.assertEqual(self.patch(ruta, {'estado': estado}, **self.auth('COCINA')).status_code, 200)
        self.assertEqual(self.patch(ruta, {'estado': 'ENTREGADO'}, **self.auth('COCINA')).status_code, 403)

    def test_el_personal_no_hace_lo_que_es_del_cliente(self):
        pedido, token = self.crear_pedido()
        for rol in ('MESERO', 'COCINA', 'ADMIN'):
            h = self.auth(rol)
            self.assertEqual(self.post('/api/pagos', {'pedidoId': pedido['id']}, **h).status_code, 403, rol)
            self.assertEqual(self.patch(f'/api/pedidos/{pedido["id"]}/propina', {'porcentaje': 10}, **h).status_code, 403, rol)
            self.assertEqual(self.post(f'/api/pedidos/{pedido["id"]}/cancelar', **h).status_code, 403, rol)
            self.assertEqual(self.post('/api/solicitudes', {'codigoMesa': self.codigo, 'motivo': 'ayuda'}, **h).status_code, 403, rol)
            self.assertEqual(self.post('/api/calificaciones', {'pedidoId': pedido['id'], 'estrellas': 5}, **h).status_code, 403, rol)
        # El cliente sí puede pagar en línea con su token de seguimiento.
        self.assertEqual(self.post('/api/pagos', {'pedidoId': pedido['id']}, **self.tk(token)).status_code, 201)

    def test_la_cocina_no_cobra(self):
        pedido, _ = self.crear_pedido()
        self.assertEqual(self.cobrar(pedido['id'], rol='COCINA').status_code, 403)


class CobroEnMesaTest(BaseApi):
    def test_el_mesero_cobra_solo_con_permiso_y_queda_registrado_quien(self):
        Usuario.objects.filter(rol='MESERO').update(puede_cobrar=False)
        pedido, _ = self.crear_pedido()
        self.assertEqual(self.cobrar(pedido['id']).status_code, 403)
        mesero = Usuario.objects.get(rol='MESERO')
        r = self.patch(f'/api/usuarios/{mesero.id}', {'puedeCobrar': True}, **self.auth('ADMIN'))
        self.assertEqual((r.status_code, r.data['puedeCobrar']), (200, True))
        # Cambiar el permiso cierra la sesión anterior: el mesero vuelve a entrar.
        self.tokens['MESERO'] = self.login('mesero@t.co').data['token']
        r = self.cobrar(pedido['id'], efectivoRecibido=50000)
        self.assertEqual(r.status_code, 201, r.data)
        pago = Pago.objects.get(id=r.data['id'])
        self.assertEqual((pago.registrado_por_id, pago.metodo, pago.proveedor), (mesero.id, 'EFECTIVO', 'efectivo'))
        self.assertEqual(r.data['cambio'], 50000 - pago.monto)

    def test_un_reintento_no_duplica_y_no_se_cobra_mas_que_el_saldo(self):
        pedido, _ = self.crear_pedido()
        clave = uuid.uuid4().hex
        primero = self.cobrar(pedido['id'], clave=clave, monto=1000)
        repetido = self.cobrar(pedido['id'], clave=clave, monto=1000)
        self.assertEqual((primero.status_code, repetido.status_code, repetido.data['id']), (201, 201, primero.data['id']))
        self.assertEqual(Pago.objects.filter(pedido_id=pedido['id']).count(), 1)
        self.assertEqual(self.cobrar(pedido['id'], monto=10_000_000).status_code, 400)

    def test_un_cobro_igual_seguido_pide_confirmacion(self):
        pedido, _ = self.crear_pedido()
        self.assertEqual(self.cobrar(pedido['id'], monto=2000).status_code, 201)
        self.assertEqual(self.cobrar(pedido['id'], monto=2000).status_code, 409)
        self.assertEqual(self.cobrar(pedido['id'], monto=2000, confirmarDuplicado=True).status_code, 201)

    def test_datafono_exige_codigo_de_aprobacion_y_no_lo_repite(self):
        pedido, _ = self.crear_pedido()
        self.assertEqual(self.cobrar(pedido['id'], metodo='TARJETA', monto=1000).status_code, 400)
        ok = self.cobrar(pedido['id'], metodo='TARJETA', monto=1000, codigoAutorizacion='A1B2C3')
        self.assertEqual((ok.status_code, ok.data['metodo']), (201, 'TARJETA'))
        self.assertEqual(self.cobrar(pedido['id'], metodo='TARJETA', monto=1500, codigoAutorizacion='a1b2c3').status_code, 409)

    def test_solo_el_admin_anula_con_motivo_y_el_saldo_vuelve(self):
        pedido, _ = self.crear_pedido()
        pago = self.cobrar(pedido['id']).data
        ruta = f'/api/pagos/{pago["id"]}/anular'
        self.assertEqual(self.patch(ruta, {'motivo': 'Error al digitar'}, **self.auth('MESERO')).status_code, 403)
        self.assertEqual(self.patch(ruta, {'motivo': 'x'}, **self.auth('ADMIN')).status_code, 400)
        r = self.patch(ruta, {'motivo': 'Se registró en la mesa equivocada'}, **self.auth('ADMIN'))
        self.assertEqual((r.status_code, r.data['estado'], r.data['anuladoPor']), (200, 'ANULADO', 'ADMIN'))
        self.assertEqual(self.http.get(f'/api/pedidos/{pedido["id"]}', **self.auth('ADMIN')).data['estadoPago'], 'PENDIENTE')


class CierreCajaTest(BaseApi):
    def test_cierre_con_totales_diferencia_y_cuentas_abiertas(self):
        a = self.auth('ADMIN')
        pagado, _ = self.crear_pedido()
        self.cobrar(pagado['id'], metodo='TARJETA', monto=5000, codigoAutorizacion='998877')
        self.cobrar(pagado['id'])  # el resto en efectivo
        abierto, _ = self.crear_pedido()
        self.entregar(abierto['id'])  # entregado y sin pagar

        self.assertEqual(self.http.get('/api/pagos/caja', **self.auth('MESERO')).status_code, 403)
        resumen = self.http.get('/api/pagos/caja', **a).data
        self.assertEqual(resumen['totalDatafono'], 5000)
        self.assertEqual(resumen['cantidadPagos'], 2)
        self.assertEqual(len(resumen['cuentasAbiertas']), 1)

        esperado = resumen['totalEfectivo']
        self.assertEqual(self.post('/api/pagos/caja/cierres', {'efectivoContado': esperado}, **a).status_code, 409)
        r = self.post('/api/pagos/caja/cierres', {'efectivoContado': esperado - 1000, 'confirmarPendientes': True,
                                                   'notas': 'Faltaron mil pesos'}, **a)
        self.assertEqual((r.status_code, r.data['diferencia'], r.data['cantidadPagos']), (201, -1000, 2))
        cierre = CierreCaja.objects.get(id=r.data['id'])
        self.assertEqual(Pago.objects.filter(cierre=cierre).count(), 2)

        # Lo cerrado no se anula y la caja nueva arranca en cero.
        cerrado = Pago.objects.filter(cierre=cierre).first()
        self.assertEqual(self.patch(f'/api/pagos/{cerrado.id}/anular', {'motivo': 'Intento tardío'}, **a).status_code, 409)
        self.assertEqual(self.http.get('/api/pagos/caja', **a).data['cantidadPagos'], 0)
        self.assertEqual(self.http.get('/api/pagos/caja/cierres', **a).data['total'], 1)
