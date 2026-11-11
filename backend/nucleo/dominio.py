"""Valores del dominio. Única fuente de verdad del backend."""

ROLES = ('ADMIN', 'CLIENTE', 'MESERO', 'COCINA')
ROLES_PERSONAL = ('ADMIN', 'MESERO', 'COCINA')

ESTADOS_PEDIDO = ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO')
ESTADOS_ACTIVOS = ('PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'LISTO')

ESTADOS_PAGO_PEDIDO = ('PENDIENTE', 'PARCIAL', 'PAGADO', 'REEMBOLSADO')
ESTADOS_PAGO = ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'ANULADO', 'ERROR', 'REEMBOLSO_SOLICITADO', 'REEMBOLSADO')

TIPOS_PEDIDO = ('mesa', 'llevar')
MOTIVOS_SOLICITUD = ('cuenta', 'utensilios', 'ayuda')

# Máquina de estados: PENDIENTE → CONFIRMADO → EN_PREPARACION → LISTO → ENTREGADO; (PENDIENTE|CONFIRMADO) → CANCELADO.
# Para cada transición, los roles del personal que pueden ejecutarla.
TRANSICIONES = {
    'PENDIENTE': {'CONFIRMADO': ('ADMIN', 'MESERO', 'COCINA'), 'CANCELADO': ('ADMIN', 'MESERO')},
    'CONFIRMADO': {'EN_PREPARACION': ('ADMIN', 'COCINA'), 'CANCELADO': ('ADMIN', 'MESERO')},
    'EN_PREPARACION': {'LISTO': ('ADMIN', 'COCINA')},
    'LISTO': {'ENTREGADO': ('ADMIN', 'MESERO')},
    'ENTREGADO': {},
    'CANCELADO': {},
}


def puede_transicionar(desde: str, hacia: str, rol: str) -> bool:
    return rol in TRANSICIONES.get(desde, {}).get(hacia, ())
