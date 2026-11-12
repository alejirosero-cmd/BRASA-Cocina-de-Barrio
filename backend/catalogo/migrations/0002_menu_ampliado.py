"""
Menú ampliado: crea las categorías nuevas y deja el orden del menú como en catalogo.json.

El comando `sembrar` nunca sobrescribe lo que ya existe, por eso el reordenamiento se hace aquí una
sola vez. Solo toca las categorías por su slug y mueve el Combo Brasa a la categoría Combos.
"""
from django.db import migrations

CATEGORIAS = [
    ('hamburguesas', 'Hamburguesas'),
    ('pollo', 'Pollo y alitas'),
    ('perros-sandwiches', 'Perros y sándwiches'),
    ('combos', 'Combos'),
    ('acompanamientos', 'Acompañamientos'),
    ('ensaladas', 'Ensaladas y bowls'),
    ('bebidas', 'Bebidas'),
    ('postres', 'Postres'),
]


def aplicar(apps, schema_editor):
    Categoria = apps.get_model('catalogo', 'Categoria')
    Producto = apps.get_model('catalogo', 'Producto')
    if not Categoria.objects.exists():
        return  # Base nueva: `sembrar` crea todo con el orden correcto.
    for orden, (slug, nombre) in enumerate(CATEGORIAS):
        categoria, creada = Categoria.objects.get_or_create(slug=slug, defaults={'nombre': nombre, 'orden': orden})
        if not creada and categoria.orden != orden:
            categoria.orden = orden
            categoria.save(update_fields=['orden'])
    combos = Categoria.objects.get(slug='combos')
    Producto.objects.filter(slug='combo-brasa').update(categoria=combos)


def revertir(apps, schema_editor):
    Categoria = apps.get_model('catalogo', 'Categoria')
    Producto = apps.get_model('catalogo', 'Producto')
    hamburguesas = Categoria.objects.filter(slug='hamburguesas').first()
    if hamburguesas:
        Producto.objects.filter(slug='combo-brasa').update(categoria=hamburguesas)


class Migration(migrations.Migration):
    dependencies = [('catalogo', '0001_initial')]
    operations = [migrations.RunPython(aplicar, revertir)]
