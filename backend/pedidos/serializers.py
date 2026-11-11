from rest_framework import serializers

from nucleo.dominio import ESTADOS_PEDIDO, TIPOS_PEDIDO
from nucleo.serializadores import Estricto

from .precios import CANTIDAD_MAX_POR_ITEM, ITEMS_MAX_POR_PEDIDO

ID = r'^[a-z0-9-]{1,60}$'
CODIGO_MESA = serializers.RegexField(r'^[A-Za-z0-9]{6,12}$', required=False,
                                     error_messages={'invalid': 'Código de mesa no válido'})


def _ids():
    return serializers.ListField(child=serializers.RegexField(ID), max_length=20, required=False)


class ItemPedido(Estricto):
    productoId = serializers.RegexField(ID)
    cantidad = serializers.IntegerField(min_value=1, max_value=CANTIDAD_MAX_POR_ITEM)
    tamanoId = serializers.RegexField(ID, required=False)
    extras = _ids()
    salsas = _ids()
    retirados = serializers.ListField(child=serializers.CharField(max_length=60), max_length=20, required=False)
    instrucciones = serializers.CharField(max_length=200, required=False, allow_blank=True)


class _Items(Estricto):
    items = ItemPedido(many=True, allow_empty=False, max_length=ITEMS_MAX_POR_PEDIDO,
                       error_messages={'empty': 'El pedido está vacío'})
    cupon = serializers.CharField(max_length=30, required=False, allow_blank=True)
    propinaPorcentaje = serializers.IntegerField(min_value=0, max_value=100, required=False)


class Cotizar(_Items):
    pass


class CrearPedido(_Items):
    tipo = serializers.ChoiceField(choices=TIPOS_PEDIDO)
    codigoMesa = serializers.RegexField(r'^[A-Za-z0-9]{6,12}$', required=False,
                                        error_messages={'invalid': 'Código de mesa no válido'})
    notasCocina = serializers.CharField(max_length=300, required=False, allow_blank=True)


class CambiarEstado(Estricto):
    estado = serializers.ChoiceField(choices=ESTADOS_PEDIDO)
    nota = serializers.CharField(max_length=200, required=False, allow_blank=True)


class Propina(Estricto):
    porcentaje = serializers.IntegerField(min_value=0, max_value=100)


class DatosFactura(Estricto):
    tipoDocumento = serializers.ChoiceField(choices=('CC', 'CE', 'NIT', 'PP', 'TI'))
    numeroDocumento = serializers.RegexField(r'^[0-9A-Za-z-]{5,20}$',
                                             error_messages={'invalid': 'Número de documento no válido'})
    nombre = serializers.CharField(min_length=2, max_length=120)
    correo = serializers.EmailField(max_length=254, error_messages={'invalid': 'Correo electrónico no válido'})
    # Autorización de tratamiento de datos personales (Ley 1581 de 2012).
    aceptaTratamientoDatos = serializers.BooleanField()
