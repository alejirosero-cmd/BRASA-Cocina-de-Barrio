"""El menú inicial (catalogo.json) debe pasar las mismas validaciones que usa el panel de administración."""
import json
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase

from catalogo.serializers import GuardarCategoria, GuardarProducto

DATOS = json.loads((Path(settings.BASE_DIR) / 'catalogo' / 'datos' / 'catalogo.json').read_text(encoding='utf-8'))
PUBLICO = Path(settings.BASE_DIR).parent / 'public'


class CatalogoInicialTest(SimpleTestCase):
    def test_categorias_validas_y_sin_repetir(self):
        ids = [c['id'] for c in DATOS['categorias']]
        self.assertEqual(len(ids), len(set(ids)))
        for c in DATOS['categorias']:
            s = GuardarCategoria(data=c)
            self.assertTrue(s.is_valid(), (c['id'], s.errors))

    def test_productos_validos(self):
        categorias = {c['id'] for c in DATOS['categorias']}
        ids = [p['id'] for p in DATOS['productos']]
        self.assertEqual(len(ids), len(set(ids)))
        for p in DATOS['productos']:
            s = GuardarProducto(data=p)
            self.assertTrue(s.is_valid(), (p['id'], s.errors))
            self.assertIn(p['categoria'], categorias, p['id'])

    def test_todas_las_categorias_tienen_productos(self):
        usadas = {p['categoria'] for p in DATOS['productos']}
        for c in DATOS['categorias']:
            self.assertIn(c['id'], usadas, f'La categoría {c["id"]} quedó vacía')

    def test_cada_producto_tiene_su_foto(self):
        if not PUBLICO.is_dir():
            self.skipTest('La carpeta public/ del frontend no está disponible (imagen Docker del backend).')
        for p in DATOS['productos']:
            self.assertTrue((PUBLICO / p['imagenUrl']).is_file(), p['imagenUrl'])
