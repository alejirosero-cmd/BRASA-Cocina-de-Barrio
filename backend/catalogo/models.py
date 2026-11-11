from django.db import models

from nucleo.models import nuevo_id


class Categoria(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    slug = models.SlugField(unique=True, max_length=40)
    nombre = models.CharField(max_length=40)
    orden = models.IntegerField(default=0)
    activa = models.BooleanField(default=True)

    class Meta:
        ordering = ['orden']

    def publica(self) -> dict:
        return {'id': self.slug, 'nombre': self.nombre, 'orden': self.orden, 'activa': self.activa}


class Producto(models.Model):
    """Precios en pesos colombianos enteros. Las opciones se guardan como JSON."""

    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    slug = models.SlugField(unique=True, max_length=60)
    nombre = models.CharField(max_length=80)
    descripcion = models.CharField(max_length=400, blank=True)
    precio = models.PositiveIntegerField()
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name='productos')
    imagen_url = models.CharField(max_length=300)
    etiquetas = models.JSONField(default=list)
    ingredientes = models.JSONField(default=list)
    tamanos = models.JSONField(default=list)  # [{id, nombre, diferenciaPrecio}]
    extras = models.JSONField(default=list)  # [{id, nombre, precio}]
    salsas = models.JSONField(default=list)  # [{id, nombre, precio}]
    retirables = models.JSONField(default=list)  # [{id, nombre}]
    tiempo_preparacion_min = models.PositiveIntegerField(default=15)
    disponible = models.BooleanField(default=True, db_index=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    def publico(self) -> dict:
        """Misma forma que el modelo `Producto` del frontend."""
        return {
            'id': self.slug,
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'precio': self.precio,
            'categoria': self.categoria.slug,
            'imagenUrl': self.imagen_url,
            'etiquetas': self.etiquetas,
            'ingredientes': self.ingredientes,
            'tamanos': self.tamanos,
            'extras': self.extras,
            'salsas': self.salsas,
            'retirables': self.retirables,
            'tiempoPreparacionMin': self.tiempo_preparacion_min,
            'disponible': self.disponible,
        }
