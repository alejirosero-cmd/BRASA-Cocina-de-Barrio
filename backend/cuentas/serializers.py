from rest_framework import serializers

from nucleo.dominio import ROLES
from nucleo.serializadores import Estricto

# OWASP ASVS 5.0 V6.2: mínimo 8 (usamos 10), máximo amplio y sin reglas de composición.
MIN, MAX = 10, 128
MSJ_CLAVE = f'La contraseña debe tener entre {MIN} y {MAX} caracteres'
MSJ_CORREO = 'Correo electrónico no válido'


class Correo(serializers.EmailField):
    def __init__(self, **kwargs):
        super().__init__(max_length=254, error_messages={'invalid': MSJ_CORREO, 'required': MSJ_CORREO}, **kwargs)

    def to_internal_value(self, data):
        return super().to_internal_value(data).strip().lower()


def clave(**kw):
    return serializers.CharField(min_length=MIN, max_length=MAX, trim_whitespace=False,
                                 error_messages={'min_length': MSJ_CLAVE, 'max_length': MSJ_CLAVE}, **kw)


def nombre(**kw):
    m = 'El nombre debe tener entre 2 y 80 caracteres'
    return serializers.CharField(min_length=2, max_length=80, error_messages={'min_length': m, 'max_length': m}, **kw)


class Registro(Estricto):
    email = Correo()
    nombre = nombre()
    password = clave()


class Login(Estricto):
    email = Correo()
    password = serializers.CharField(max_length=MAX, trim_whitespace=False)


class SolicitarRecuperacion(Estricto):
    email = Correo()


class Restablecer(Estricto):
    token = serializers.CharField(min_length=20, max_length=200)
    password = clave()


class LoginKeycloak(Estricto):
    token = serializers.CharField(min_length=20, max_length=8000)


class CambiarPassword(Estricto):
    actual = serializers.CharField(max_length=MAX, trim_whitespace=False)
    nueva = clave()


class ActualizarPerfil(Estricto):
    nombre = nombre()


class CrearUsuario(Registro):
    rol = serializers.ChoiceField(choices=ROLES, error_messages={'invalid_choice': 'Rol no válido'})


class ActualizarUsuario(Estricto):
    rol = serializers.ChoiceField(choices=ROLES, required=False, error_messages={'invalid_choice': 'Rol no válido'})
    activo = serializers.BooleanField(required=False)
    nombre = nombre(required=False)
