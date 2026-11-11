from rest_framework.response import Response

from nucleo.excepciones import Conflicto, NoEncontrado, SolicitudInvalida
from nucleo.models import registrar
from nucleo.serializadores import validar
from nucleo.vistas import VistaPublica, vista_roles

from . import serializers as s
from .models import Categoria, Producto


def _productos(todos: bool):
    qs = Producto.objects.select_related('categoria').order_by('categoria__orden', 'nombre')
    if not todos:
        qs = qs.filter(disponible=True, categoria__activa=True)
    return [p.publico() for p in qs]


def _datos_producto(d: dict) -> dict:
    categoria = Categoria.objects.filter(slug=d['categoria']).first()
    if not categoria:
        raise SolicitudInvalida('La categoría no existe')
    return {
        'slug': d['id'], 'nombre': d['nombre'], 'descripcion': d['descripcion'], 'precio': d['precio'],
        'categoria': categoria, 'imagen_url': d['imagenUrl'], 'etiquetas': d['etiquetas'],
        'ingredientes': d['ingredientes'], 'tamanos': d['tamanos'], 'extras': d['extras'], 'salsas': d['salsas'],
        'retirables': d['retirables'], 'tiempo_preparacion_min': d['tiempoPreparacionMin'],
        'disponible': d.get('disponible', True),
    }


class ProductosVista(VistaPublica):
    """GET público (menú) y POST solo para el administrador."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [p() for p in vista_roles('ADMIN').permission_classes]
        return super().get_permissions()

    def get(self, request):
        return Response(_productos(todos=False))

    def post(self, request):
        d = validar(s.GuardarProducto, request.data)
        if Producto.objects.filter(slug=d['id']).exists():
            raise Conflicto('Ya existe un producto con ese identificador')
        producto = Producto.objects.create(**_datos_producto(d))
        registrar('producto.creado', 'Producto', producto.id, request.user.id)
        return Response(producto.publico(), status=201)


class CategoriasPublicasVista(VistaPublica):
    """GET público y POST (crear categoría) solo para el administrador."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [p() for p in vista_roles('ADMIN').permission_classes]
        return super().get_permissions()

    def get(self, request):
        return Response([c.publica() for c in Categoria.objects.filter(activa=True)])

    def post(self, request):
        d = validar(s.GuardarCategoria, request.data)
        if Categoria.objects.filter(slug=d['id']).exists():
            raise Conflicto('Ya existe una categoría con ese identificador')
        c = Categoria.objects.create(slug=d['id'], nombre=d['nombre'], orden=d['orden'], activa=d.get('activa', True))
        registrar('categoria.creada', 'Categoria', c.id, request.user.id)
        return Response(c.publica(), status=201)


class ProductosAdminVista(vista_roles('ADMIN')):
    def get(self, request):
        return Response(_productos(todos=True))


class CategoriasAdminVista(vista_roles('ADMIN')):
    def get(self, request):
        return Response([c.publica() for c in Categoria.objects.all()])


class ProductoVista(vista_roles('ADMIN')):
    def put(self, request, slug):
        actual = Producto.objects.filter(slug=slug).first()
        if not actual:
            raise NoEncontrado('Producto no encontrado')
        d = validar(s.GuardarProducto, request.data)
        if d['id'] != slug and Producto.objects.filter(slug=d['id']).exists():
            raise Conflicto('Ya existe un producto con ese identificador')
        precio_anterior = actual.precio
        for campo, valor in _datos_producto(d).items():
            setattr(actual, campo, valor)
        actual.save()
        registrar('producto.actualizado', 'Producto', actual.id, request.user.id,
                  {'precioAnterior': precio_anterior, 'precioNuevo': actual.precio})
        return Response(actual.publico())


class DisponibilidadVista(vista_roles('ADMIN', 'COCINA', 'MESERO')):
    """Los productos no se borran (los pedidos antiguos los referencian): se marcan agotados."""

    def patch(self, request, slug):
        disponible = validar(s.Disponibilidad, request.data)['disponible']
        producto = Producto.objects.select_related('categoria').filter(slug=slug).first()
        if not producto:
            raise NoEncontrado('Producto no encontrado')
        producto.disponible = disponible
        producto.save(update_fields=['disponible', 'actualizado_en'])
        registrar('producto.disponibilidad', 'Producto', producto.id, request.user.id, {'disponible': disponible})
        return Response(producto.publico())


class CategoriaVista(vista_roles('ADMIN')):
    def put(self, request, slug):
        c = Categoria.objects.filter(slug=slug).first()
        if not c:
            raise NoEncontrado('Categoría no encontrada')
        d = validar(s.GuardarCategoria, request.data)
        if d['id'] != slug and Categoria.objects.filter(slug=d['id']).exists():
            raise Conflicto('Ya existe una categoría con ese identificador')
        c.slug, c.nombre, c.orden = d['id'], d['nombre'], d['orden']
        c.activa = d.get('activa', c.activa)
        c.save()
        registrar('categoria.actualizada', 'Categoria', c.id, request.user.id)
        return Response(c.publica())
