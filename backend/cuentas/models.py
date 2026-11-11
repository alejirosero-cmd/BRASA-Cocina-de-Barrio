from django.contrib.auth.hashers import check_password, make_password
from django.db import models

from nucleo.models import nuevo_id


class Usuario(models.Model):
    ROLES = [('ADMIN', 'Administrador'), ('CLIENTE', 'Cliente'), ('MESERO', 'Mesero'), ('COCINA', 'Cocina')]

    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    email = models.EmailField(unique=True, max_length=254)
    nombre = models.CharField(max_length=80)
    password_hash = models.CharField(max_length=255)
    rol = models.CharField(max_length=10, choices=ROLES, default='CLIENTE', db_index=True)
    activo = models.BooleanField(default=True)
    # Se incrementa al cambiar contraseña o rol: invalida los tokens emitidos antes.
    version_sesion = models.IntegerField(default=0)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    # Lo que Django REST Framework espera de un usuario autenticado.
    is_authenticated = True
    is_anonymous = False

    def establecer_password(self, clave: str) -> None:
        self.password_hash = make_password(clave)

    def verificar_password(self, clave: str) -> bool:
        return check_password(clave, self.password_hash)

    def publico(self) -> dict:
        return {'id': self.id, 'email': self.email, 'nombre': self.nombre, 'rol': self.rol}

    def __str__(self) -> str:
        return f'{self.email} ({self.rol})'


class TokenRecuperacion(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='tokens_recuperacion')
    # Hash SHA-256 del token; el token en claro solo viaja en el enlace enviado al usuario.
    token_hash = models.CharField(max_length=64, unique=True)
    expira_en = models.DateTimeField()
    usado_en = models.DateTimeField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
