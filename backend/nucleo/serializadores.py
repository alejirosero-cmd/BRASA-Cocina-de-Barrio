from rest_framework import serializers
from rest_framework.settings import api_settings


class Estricto(serializers.Serializer):
    """
    Rechaza cualquier campo que no esté declarado (equivale a forbidNonWhitelisted).
    Así nadie puede colar, por ejemplo, un precio o un rol en la petición.
    """

    def to_internal_value(self, data):
        if isinstance(data, dict):
            sobrantes = sorted(set(data) - set(self.fields))
            if sobrantes:
                raise serializers.ValidationError(
                    {api_settings.NON_FIELD_ERRORS_KEY: [f'El campo "{c}" no está permitido' for c in sobrantes]}
                )
        return super().to_internal_value(data)


class TextoLimpio(serializers.CharField):
    """Texto con espacios recortados."""

    def __init__(self, **kwargs):
        kwargs.setdefault('trim_whitespace', True)
        super().__init__(**kwargs)


def validar(serializador_clase, datos, **contexto):
    s = serializador_clase(data=datos, context=contexto)
    s.is_valid(raise_exception=True)
    return s.validated_data
