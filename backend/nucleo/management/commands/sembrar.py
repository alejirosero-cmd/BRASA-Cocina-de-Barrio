"""
Datos iniciales: categorías, productos, 12 mesas, cupones y usuarios.
Es idempotente: se puede ejecutar varias veces sin duplicar nada ni sobrescribir lo que el
administrador haya cambiado.

    python manage.py sembrar
"""
import json
import os
import secrets
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from catalogo.models import Categoria, Producto
from cuentas.models import Usuario
from mesas.models import Mesa
from pedidos.models import Cupon

DATOS = Path(settings.BASE_DIR) / 'catalogo' / 'datos' / 'catalogo.json'


class Command(BaseCommand):
    help = 'Carga los datos iniciales de BRASA (idempotente).'

    def handle(self, *args, **opciones):
        datos = json.loads(DATOS.read_text(encoding='utf-8'))
        for c in datos['categorias']:
            Categoria.objects.get_or_create(slug=c['id'], defaults={'nombre': c['nombre'], 'orden': c['orden']})
        for p in datos['productos']:
            Producto.objects.get_or_create(slug=p['id'], defaults={
                'nombre': p['nombre'], 'descripcion': p['descripcion'], 'precio': p['precio'],
                'categoria': Categoria.objects.get(slug=p['categoria']), 'imagen_url': p['imagenUrl'],
                'etiquetas': p['etiquetas'], 'ingredientes': p['ingredientes'], 'tamanos': p['tamanos'],
                'extras': p['extras'], 'salsas': p['salsas'], 'retirables': p['retirables'],
                'tiempo_preparacion_min': p['tiempoPreparacionMin'],
            })
        for numero in range(1, 13):
            Mesa.objects.get_or_create(numero=numero)
        for c in datos['cupones']:
            Cupon.objects.get_or_create(codigo=c['codigo'], defaults={'porcentaje': c['porcentaje']})
        self.stdout.write(f'  {len(datos["categorias"])} categorías, {len(datos["productos"])} productos, 12 mesas')

        self._usuario(os.environ.get('SEMILLA_ADMIN_EMAIL', 'admin@brasa.local'), 'Administrador', 'ADMIN',
                      os.environ.get('SEMILLA_ADMIN_PASSWORD'))
        if not settings.ES_PRODUCCION:
            # Cada rol puede tener su propia contraseña; si no, se usa la de demostración.
            demo = os.environ.get('SEMILLA_DEMO_PASSWORD')
            self._usuario('cocina@brasa.local', 'Cocina', 'COCINA', os.environ.get('SEMILLA_COCINA_PASSWORD') or demo)
            self._usuario('mesero@brasa.local', 'Mesero', 'MESERO', os.environ.get('SEMILLA_MESERO_PASSWORD') or demo)
        self.stdout.write(self.style.SUCCESS('Listo.'))

    def _usuario(self, email, nombre, rol, clave):
        if Usuario.objects.filter(email=email).exists():
            return
        definida = bool(clave) and len(clave) >= 10
        clave = clave if definida else secrets.token_urlsafe(12)
        # El mesero de demostración puede cobrar en la mesa; el administrador lo puede quitar.
        u = Usuario(email=email, nombre=nombre, rol=rol, puede_cobrar=rol == 'MESERO')
        u.establecer_password(clave)
        u.save()
        # Se muestra una sola vez y no se guarda en ningún archivo.
        self.stdout.write(f'  Usuario {rol:<7} {email}  contraseña: {"(definida en .env)" if definida else clave}')
