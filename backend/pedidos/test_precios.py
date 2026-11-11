from django.test import SimpleTestCase

from nucleo.dominio import puede_transicionar

from .precios import ErrorDePedido, ProductoParaPrecio, calcular_linea, calcular_totales, estimar_tiempo

HAMBURGUESA = ProductoParaPrecio(
    slug='brasa-original', nombre='Brasa Original', precio=18900, disponible=True, tiempo_preparacion_min=15,
    tamanos=[{'id': 'sencilla', 'nombre': 'Sencilla', 'diferenciaPrecio': 0},
             {'id': 'doble', 'nombre': 'Doble carne', 'diferenciaPrecio': 6000}],
    extras=[{'id': 'queso', 'nombre': 'Queso extra', 'precio': 2500}, {'id': 'tocino', 'nombre': 'Tocino', 'precio': 3500}],
    salsas=[{'id': 'ajo', 'nombre': 'Alioli de ajo', 'precio': 1000}],
    retirables=[{'id': 'cebolla', 'nombre': 'Cebolla'}],
)


def item(**cambios):
    return {'productoId': 'brasa-original', 'cantidad': 1, **cambios}


class CalcularLineaTest(SimpleTestCase):
    def test_usa_el_primer_tamano_y_el_precio_del_catalogo(self):
        l = calcular_linea(HAMBURGUESA, item(cantidad=2))
        self.assertEqual(l['precio_unitario'], 18900)
        self.assertEqual(l['personalizacion']['tamano']['id'], 'sencilla')

    def test_suma_tamano_extras_y_salsas(self):
        l = calcular_linea(HAMBURGUESA, item(tamanoId='doble', extras=['queso', 'tocino'], salsas=['ajo']))
        self.assertEqual(l['precio_unitario'], 18900 + 6000 + 2500 + 3500 + 1000)

    def test_no_cobra_dos_veces_un_extra_repetido(self):
        self.assertEqual(calcular_linea(HAMBURGUESA, item(extras=['queso', 'queso']))['precio_unitario'], 18900 + 2500)

    def test_retirar_por_id_o_por_nombre(self):
        self.assertEqual(calcular_linea(HAMBURGUESA, item(retirados=['cebolla']))['personalizacion']['retirados'], ['Cebolla'])
        self.assertEqual(calcular_linea(HAMBURGUESA, item(retirados=['Cebolla']))['personalizacion']['retirados'], ['Cebolla'])

    def test_rechaza_datos_invalidos(self):
        for caso in [{'tamanoId': 'triple'}, {'extras': ['caviar']}, {'retirados': ['Carne']},
                     {'cantidad': 0}, {'cantidad': 21}, {'cantidad': 1.5}]:
            with self.subTest(caso=caso), self.assertRaises(ErrorDePedido):
                calcular_linea(HAMBURGUESA, item(**caso))

    def test_rechaza_productos_agotados(self):
        agotado = ProductoParaPrecio(**{**HAMBURGUESA.__dict__, 'disponible': False})
        with self.assertRaisesMessage(ErrorDePedido, 'no está disponible'):
            calcular_linea(agotado, item())


class TotalesTest(SimpleTestCase):
    def test_impuestos_y_propina_sobre_subtotal_menos_descuento(self):
        t = calcular_totales([{'precio_unitario': 10000, 'cantidad': 2}], 10, 19, 10)
        self.assertEqual(t, {'subtotal': 20000, 'descuento': 2000, 'impuestos': 3420, 'propina': 1800, 'total': 23220})

    def test_redondeo_igual_que_el_frontend(self):
        # 18900 × 19 % = 3591; 28400 × 19 % = 5396 (redondeo "half up", no al par).
        self.assertEqual(calcular_totales([{'precio_unitario': 18900, 'cantidad': 1}], 0, 19, 0)['impuestos'], 3591)
        self.assertEqual(calcular_totales([{'precio_unitario': 25, 'cantidad': 1}], 0, 10, 0)['impuestos'], 3)

    def test_tiempo_estimado_con_tope_de_90(self):
        tres = calcular_linea(HAMBURGUESA, item(cantidad=3))
        self.assertEqual(estimar_tiempo([HAMBURGUESA], [tres]), 19)
        veinte = calcular_linea(HAMBURGUESA, item(cantidad=20))
        self.assertEqual(estimar_tiempo([HAMBURGUESA], [veinte, veinte, veinte]), 90)


class MaquinaDeEstadosTest(SimpleTestCase):
    def test_flujo_completo_con_los_roles_correctos(self):
        self.assertTrue(puede_transicionar('PENDIENTE', 'CONFIRMADO', 'MESERO'))
        self.assertTrue(puede_transicionar('CONFIRMADO', 'EN_PREPARACION', 'COCINA'))
        self.assertTrue(puede_transicionar('EN_PREPARACION', 'LISTO', 'COCINA'))
        self.assertTrue(puede_transicionar('LISTO', 'ENTREGADO', 'MESERO'))

    def test_impide_saltar_pasos_retroceder_o_reabrir(self):
        for desde, hacia, rol in [('PENDIENTE', 'LISTO', 'ADMIN'), ('CONFIRMADO', 'ENTREGADO', 'ADMIN'),
                                  ('LISTO', 'EN_PREPARACION', 'COCINA'), ('ENTREGADO', 'PENDIENTE', 'ADMIN'),
                                  ('CANCELADO', 'CONFIRMADO', 'ADMIN'), ('EN_PREPARACION', 'CANCELADO', 'ADMIN')]:
            with self.subTest(desde=desde, hacia=hacia):
                self.assertFalse(puede_transicionar(desde, hacia, rol))

    def test_responsabilidades_por_rol(self):
        self.assertFalse(puede_transicionar('LISTO', 'ENTREGADO', 'COCINA'))
        self.assertFalse(puede_transicionar('EN_PREPARACION', 'LISTO', 'MESERO'))
        self.assertFalse(puede_transicionar('PENDIENTE', 'CANCELADO', 'COCINA'))
        self.assertFalse(puede_transicionar('PENDIENTE', 'CONFIRMADO', 'CLIENTE'))
