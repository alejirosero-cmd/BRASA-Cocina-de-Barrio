from datetime import timedelta
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework import exceptions

from nucleo.autenticacion import crear_token
from nucleo.excepciones import Conflicto, SolicitudInvalida
from nucleo.models import registrar
from nucleo.seguridad import generar_token, sha256

from . import correo
from .models import TokenRecuperacion, Usuario

MINUTOS_RECUPERACION = 30
# Hash ficticio para igualar el tiempo de respuesta cuando el correo no existe (no revela cuentas).
_HASH_FICTICIO = make_password('brasa-usuario-inexistente')


def sesion(usuario: Usuario) -> dict:
    return {'token': crear_token(usuario), 'usuario': usuario.publico()}


def registrar_cliente(email: str, nombre: str, password: str) -> dict:
    """Registro público: siempre crea un CLIENTE. Los roles del personal solo los asigna un administrador."""
    if Usuario.objects.filter(email=email).exists():
        raise Conflicto('Ya existe una cuenta con ese correo')
    usuario = Usuario(email=email, nombre=nombre, rol='CLIENTE')
    usuario.establecer_password(password)
    usuario.save()
    registrar('usuario.registro', 'Usuario', usuario.id, usuario.id)
    return sesion(usuario)


def iniciar_sesion(email: str, password: str) -> dict:
    usuario = Usuario.objects.filter(email=email).first()
    if usuario is None:
        from django.contrib.auth.hashers import check_password

        check_password(password, _HASH_FICTICIO)
        valida = False
    else:
        valida = usuario.verificar_password(password)
    if not usuario or not valida or not usuario.activo:
        registrar('sesion.fallida', 'Usuario', usuario.id if usuario else None, None)
        raise exceptions.AuthenticationFailed('Correo o contraseña incorrectos')
    registrar('sesion.inicio', 'Usuario', usuario.id, usuario.id)
    return sesion(usuario)


def solicitar_recuperacion(email: str) -> None:
    """Responde igual exista o no el correo, para no permitir enumerar cuentas."""
    usuario = Usuario.objects.filter(email=email, activo=True).first()
    if not usuario:
        return
    token = generar_token()
    with transaction.atomic():
        TokenRecuperacion.objects.filter(usuario=usuario, usado_en__isnull=True).update(usado_en=timezone.now())
        TokenRecuperacion.objects.create(
            usuario=usuario,
            token_hash=sha256(token),
            expira_en=timezone.now() + timedelta(minutes=MINUTOS_RECUPERACION),
        )
    correo.enviar_recuperacion(usuario.email, f'{settings.FRONTEND_URL}/restablecer?token={quote(token)}')
    registrar('password.recuperacion_solicitada', 'Usuario', usuario.id, None)


def restablecer_password(token: str, password: str) -> None:
    registro = TokenRecuperacion.objects.filter(token_hash=sha256(token)).select_related('usuario').first()
    if not registro or registro.usado_en or registro.expira_en < timezone.now():
        raise SolicitudInvalida('El enlace no es válido o ya expiró')
    with transaction.atomic():
        registro.usado_en = timezone.now()
        registro.save(update_fields=['usado_en'])
        usuario = registro.usuario
        usuario.establecer_password(password)
        usuario.version_sesion = F('version_sesion') + 1
        usuario.save(update_fields=['password_hash', 'version_sesion', 'actualizado_en'])
    registrar('password.restablecida', 'Usuario', registro.usuario_id, registro.usuario_id)


def cambiar_password(usuario: Usuario, actual: str, nueva: str) -> dict:
    if not usuario.verificar_password(actual):
        raise SolicitudInvalida('La contraseña actual no es correcta')
    usuario.establecer_password(nueva)
    usuario.version_sesion += 1
    usuario.save(update_fields=['password_hash', 'version_sesion', 'actualizado_en'])
    registrar('password.cambiada', 'Usuario', usuario.id, usuario.id)
    return sesion(usuario)  # las demás sesiones quedan invalidadas; esta recibe un token nuevo


def crear_usuario(datos: dict, actor: Usuario) -> dict:
    if Usuario.objects.filter(email=datos['email']).exists():
        raise Conflicto('Ya existe una cuenta con ese correo')
    usuario = Usuario(email=datos['email'], nombre=datos['nombre'], rol=datos['rol'])
    usuario.establecer_password(datos['password'])
    usuario.save()
    registrar('usuario.creado', 'Usuario', usuario.id, actor.id, {'rol': datos['rol']})
    return usuario.publico()


def actualizar_usuario(usuario_id: str, datos: dict, actor: Usuario) -> dict:
    usuario = Usuario.objects.filter(id=usuario_id).first()
    if not usuario:
        raise exceptions.NotFound('Usuario no encontrado')
    if usuario_id == actor.id and ((datos.get('rol') and datos['rol'] != 'ADMIN') or datos.get('activo') is False):
        raise SolicitudInvalida('No puedes quitarte el rol de administrador ni desactivarte')
    cambia_acceso = ('rol' in datos and datos['rol'] != usuario.rol) or datos.get('activo') is False
    for campo in ('rol', 'activo', 'nombre'):
        if campo in datos:
            setattr(usuario, campo, datos[campo])
    if cambia_acceso:
        usuario.version_sesion += 1
    usuario.save()
    registrar('usuario.actualizado', 'Usuario', usuario.id, actor.id, {'rol': datos.get('rol'), 'activo': datos.get('activo')})
    return {**usuario.publico(), 'activo': usuario.activo}
