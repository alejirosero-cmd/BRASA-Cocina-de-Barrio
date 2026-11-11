"""
Pruebas del inicio de sesión con Keycloak. Se firma con una llave RSA propia de la prueba (no se
contacta a ningún servidor): así se comprueba la verificación real de firma, emisor, cliente y roles.
"""
import os
import time
from unittest import mock

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from cuentas.models import Usuario

os.environ['BRASA_SIN_LIMITES'] = '1'

KC = {'url': 'http://localhost:8089', 'realm': 'brasa', 'cliente': 'brasa-web',
      'emisor': 'http://localhost:8089/realms/brasa', 'jwks': 'http://keycloak:8080/realms/brasa/protocol/openid-connect/certs'}
LLAVE = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTRA_LLAVE = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def token(llave=LLAVE, **cambios) -> str:
    ahora = int(time.time())
    reclamos = {
        'iss': KC['emisor'], 'sub': 'usuario-keycloak-1', 'azp': 'brasa-web', 'typ': 'Bearer',
        'iat': ahora, 'exp': ahora + 300, 'email': 'cocina@brasa.local', 'email_verified': True,
        'name': 'Chef de Prueba', 'realm_access': {'roles': ['COCINA', 'offline_access']},
    }
    reclamos.update(cambios)
    return jwt.encode({k: v for k, v in reclamos.items() if v is not None}, llave, algorithm='RS256', headers={'kid': 'prueba'})


@override_settings(ES_PRUEBAS=True, KEYCLOAK=KC)
@mock.patch('cuentas.keycloak._clave_publica', lambda t: LLAVE.public_key())
class KeycloakTest(TestCase):
    def setUp(self):
        cache.clear()
        self.http = APIClient()

    def entrar(self, t):
        return self.http.post('/api/auth/keycloak', {'token': t}, format='json')

    def test_config_publica_sin_secretos(self):
        r = self.http.get('/api/auth/config')
        self.assertEqual(r.data, {'keycloak': {'url': 'http://localhost:8089', 'realm': 'brasa', 'cliente': 'brasa-web'}})

    def test_token_valido_entrega_sesion_de_brasa_con_el_rol_de_keycloak(self):
        r = self.entrar(token())
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data['usuario']['email'], r.data['usuario']['rol']), ('cocina@brasa.local', 'COCINA'))
        # La sesión de BRASA funciona en las rutas del personal.
        self.assertEqual(self.http.get('/api/pedidos/activos', HTTP_AUTHORIZATION=f'Bearer {r.data["token"]}').status_code, 200)
        # La cuenta creada desde Keycloak no tiene contraseña local utilizable.
        self.assertFalse(Usuario.objects.get(email='cocina@brasa.local').password_hash.startswith('pbkdf2'))

    def test_el_rol_de_mayor_privilegio_gana_y_se_sincroniza(self):
        Usuario.objects.create(email='cocina@brasa.local', nombre='Cocina', rol='COCINA', password_hash='x')
        r = self.entrar(token(realm_access={'roles': ['COCINA', 'ADMIN']}))
        self.assertEqual(r.data['usuario']['rol'], 'ADMIN')
        self.assertEqual(Usuario.objects.get(email='cocina@brasa.local').version_sesion, 1)

    def test_rechaza_firma_emisor_cliente_y_vencimiento_invalidos(self):
        for caso, t in {
            'firmado con otra llave': token(llave=OTRA_LLAVE),
            'otro emisor': token(iss='http://atacante/realms/brasa'),
            'otro cliente': token(azp='otra-app'),
            'vencido': token(exp=int(time.time()) - 120, iat=int(time.time()) - 600),
            'token de refresco': token(typ='Refresh'),
        }.items():
            with self.subTest(caso=caso):
                self.assertEqual(self.entrar(t).status_code, 401)

    def test_sin_rol_del_personal_o_sin_correo_verificado(self):
        self.assertEqual(self.entrar(token(realm_access={'roles': ['offline_access']})).status_code, 403)
        self.assertEqual(self.entrar(token(email_verified=False)).status_code, 401)

    def test_usuario_desactivado_en_brasa(self):
        Usuario.objects.create(email='cocina@brasa.local', nombre='Cocina', rol='COCINA', password_hash='x', activo=False)
        self.assertEqual(self.entrar(token()).status_code, 401)

    @override_settings(KEYCLOAK=None)
    def test_deshabilitado_si_no_esta_configurado(self):
        self.assertEqual(self.http.get('/api/auth/config').data, {'keycloak': None})
        self.assertEqual(self.entrar(token()).status_code, 404)
