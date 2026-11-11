from rest_framework import serializers

from nucleo.serializadores import Estricto

ETIQUETAS = ('vegetariano', 'sin-gluten', 'mas-vendido')
SLUG = r'^[a-z0-9]+(?:-[a-z0-9]+)*$'
MSJ_SLUG = 'Usa solo minúsculas, números y guiones (ej. brasa-original)'


def slug(max_length=60):
    return serializers.RegexField(SLUG, max_length=max_length, error_messages={'invalid': MSJ_SLUG})


class OpcionTamano(Estricto):
    id = slug(40)
    nombre = serializers.CharField(min_length=1, max_length=60)
    diferenciaPrecio = serializers.IntegerField(min_value=-1_000_000, max_value=1_000_000)


class OpcionExtra(Estricto):
    id = slug(40)
    nombre = serializers.CharField(min_length=1, max_length=60)
    precio = serializers.IntegerField(min_value=0, max_value=1_000_000)


class Retirable(Estricto):
    id = slug(40)
    nombre = serializers.CharField(min_length=1, max_length=60)


def _ids_unicos(lista, grupo):
    ids = [o['id'] for o in lista]
    if len(set(ids)) != len(ids):
        raise serializers.ValidationError(f'Hay opciones repetidas en {grupo}')
    return lista


class GuardarProducto(Estricto):
    id = slug(60)
    nombre = serializers.CharField(min_length=2, max_length=80)
    descripcion = serializers.CharField(max_length=400, allow_blank=True)
    precio = serializers.IntegerField(min_value=0, max_value=10_000_000)
    categoria = slug(40)
    # Ruta relativa dentro de /public o URL https (evita javascript:, data:, etc.).
    imagenUrl = serializers.RegexField(r'^(img/[\w./-]+|https://[\w./%-]+)$', max_length=300,
                                       error_messages={'invalid': 'Imagen no válida'})
    etiquetas = serializers.ListField(child=serializers.ChoiceField(choices=ETIQUETAS), max_length=5)
    ingredientes = serializers.ListField(child=serializers.CharField(max_length=60), max_length=30)
    tamanos = OpcionTamano(many=True, max_length=10)
    extras = OpcionExtra(many=True, max_length=20)
    salsas = OpcionExtra(many=True, max_length=20)
    retirables = Retirable(many=True, max_length=20)
    tiempoPreparacionMin = serializers.IntegerField(min_value=1, max_value=240)
    disponible = serializers.BooleanField(required=False)

    def validate_tamanos(self, v):
        return _ids_unicos(v, 'tamaños')

    def validate_extras(self, v):
        return _ids_unicos(v, 'extras')

    def validate_salsas(self, v):
        return _ids_unicos(v, 'salsas')

    def validate_retirables(self, v):
        return _ids_unicos(v, 'ingredientes retirables')


class Disponibilidad(Estricto):
    disponible = serializers.BooleanField()


class GuardarCategoria(Estricto):
    id = slug(40)
    nombre = serializers.CharField(min_length=2, max_length=40)
    orden = serializers.IntegerField(min_value=0, max_value=1000)
    activa = serializers.BooleanField(required=False)
