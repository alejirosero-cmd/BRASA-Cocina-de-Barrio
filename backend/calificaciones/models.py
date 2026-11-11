from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from nucleo.models import nuevo_id


class Calificacion(models.Model):
    id = models.CharField(primary_key=True, max_length=32, default=nuevo_id, editable=False)
    # OneToOne: un pedido solo puede calificarse una vez (restricción UNIQUE en la base de datos).
    pedido = models.OneToOneField('pedidos.Pedido', on_delete=models.CASCADE, related_name='calificacion')
    estrellas = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comentario = models.CharField(max_length=500, blank=True, default='')
    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=models.Q(estrellas__gte=1, estrellas__lte=5), name='estrellas_entre_1_y_5'),
        ]
