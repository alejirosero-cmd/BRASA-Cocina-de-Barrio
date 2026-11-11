import hashlib
import hmac
import json
import secrets

_ALFABETO_MESA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'  # sin caracteres ambiguos (0/O, 1/I)


def generar_token(bytes_: int = 32) -> str:
    """Token aleatorio de 256 bits apto para URLs."""
    return secrets.token_urlsafe(bytes_)


def sha256(valor: str) -> str:
    return hashlib.sha256(valor.encode('utf-8')).hexdigest()


def iguales(a: str, b: str) -> bool:
    """Comparación en tiempo constante (evita ataques de temporización)."""
    return hmac.compare_digest(a.encode('utf-8'), b.encode('utf-8'))


def generar_codigo_mesa(longitud: int = 8) -> str:
    return ''.join(secrets.choice(_ALFABETO_MESA) for _ in range(longitud))


def leer_json(texto, por_defecto):
    if not texto:
        return por_defecto
    try:
        return json.loads(texto)
    except (TypeError, ValueError):
        return por_defecto
