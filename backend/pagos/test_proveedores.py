import hashlib
from urllib.parse import parse_qs, urlparse

from django.test import SimpleTestCase

from .proveedores import ProveedorWompi

CONFIG = {'public_key': 'pub_test_abc', 'private_key': 'prv_test_abc', 'events_secret': 'test_events_secreto',
          'integrity_secret': 'test_integrity_secreto', 'api_url': 'https://sandbox.wompi.co/v1',
          'checkout_url': 'https://checkout.wompi.co/p/'}


def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def evento(estado='APPROVED', secreto='test_events_secreto', monto=2522000):
    tx = {'id': '1234-1610641025-49201', 'reference': 'BRASA-1001-abc', 'status': estado,
          'amount_in_cents': 2522000, 'currency': 'COP', 'payment_method_type': 'NEQUI'}
    ts = 1730000000
    checksum = sha(f'{tx["id"]}{tx["status"]}{tx["amount_in_cents"]}{ts}{secreto}')
    tx['amount_in_cents'] = monto  # permite simular una alteración posterior a la firma
    return {'event': 'transaction.updated', 'data': {'transaction': tx}, 'environment': 'test', 'timestamp': ts,
            'signature': {'properties': ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
                          'checksum': checksum}}


class WompiTest(SimpleTestCase):
    wompi = ProveedorWompi(CONFIG)

    def test_firma_de_integridad(self):
        self.assertEqual(self.wompi.firma_integridad('REF1', 2522000), sha('REF12522000COPtest_integrity_secreto'))

    def test_url_del_checkout(self):
        q = parse_qs(urlparse(self.wompi.url_checkout('REF1', 25220, 'http://localhost:4200/pago/resultado')).query)
        self.assertEqual(q['amount-in-cents'], ['2522000'])
        self.assertEqual(q['currency'], ['COP'])
        self.assertEqual(q['signature:integrity'], [self.wompi.firma_integridad('REF1', 2522000)])

    def test_acepta_evento_firmado(self):
        r = self.wompi.verificar_webhook(evento())
        self.assertEqual((r.referencia, r.estado, r.monto_centavos, r.metodo), ('BRASA-1001-abc', 'APROBADO', 2522000, 'NEQUI'))

    def test_rechaza_otro_secreto_alteraciones_y_cuerpos_sin_firma(self):
        self.assertIsNone(self.wompi.verificar_webhook(evento(secreto='otro')))
        self.assertIsNone(self.wompi.verificar_webhook(evento(monto=100)))
        self.assertIsNone(self.wompi.verificar_webhook({'data': {}}))
        self.assertIsNone(self.wompi.verificar_webhook(None))

    def test_clave_de_idempotencia_distinta_por_estado(self):
        self.assertNotEqual(self.wompi.verificar_webhook(evento('APPROVED')).clave_idempotencia,
                            self.wompi.verificar_webhook(evento('DECLINED')).clave_idempotencia)
