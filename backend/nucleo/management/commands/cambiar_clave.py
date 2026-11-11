"""
Cambia la contraseña de un usuario desde la terminal y cierra sus sesiones abiertas.

    python manage.py cambiar_clave admin@brasa.local "MiNuevaClave2026"
"""
from django.core.management.base import BaseCommand, CommandError

from cuentas.models import Usuario


class Command(BaseCommand):
    help = 'Cambia la contraseña de un usuario.'

    def add_arguments(self, parser):
        parser.add_argument('correo')
        parser.add_argument('clave')

    def handle(self, correo, clave, **opciones):
        if not 10 <= len(clave) <= 128:
            raise CommandError('La contraseña debe tener entre 10 y 128 caracteres.')
        usuario = Usuario.objects.filter(email=correo.strip().lower()).first()
        if not usuario:
            raise CommandError(f'No existe un usuario con el correo {correo}')
        usuario.establecer_password(clave)
        usuario.version_sesion += 1
        usuario.activo = True
        usuario.save()
        self.stdout.write(self.style.SUCCESS(f'Contraseña actualizada para {usuario.email} ({usuario.rol}).'))
