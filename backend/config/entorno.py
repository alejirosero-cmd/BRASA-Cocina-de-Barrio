"""
Lectura y validación de variables de entorno. La API no arranca si falta algo obligatorio
o si un valor es inseguro (OWASP ASVS V13 – Configuración).
"""
import os
from pathlib import Path


class ErrorDeConfiguracion(Exception):
    pass


def cargar_archivo_env(ruta: Path) -> None:
    """Carga un archivo .env sencillo (CLAVE=valor). Las variables ya definidas en el sistema ganan."""
    if not ruta.exists():
        return
    for linea in ruta.read_text(encoding='utf-8').splitlines():
        linea = linea.strip()
        if not linea or linea.startswith('#') or '=' not in linea:
            continue
        clave, valor = linea.split('=', 1)
        valor = valor.strip().strip('"').strip("'")
        os.environ.setdefault(clave.strip(), valor)


def texto(nombre: str, por_defecto: str = '') -> str:
    return os.environ.get(nombre, por_defecto) or por_defecto


def numero(nombre: str, por_defecto: int, minimo: int, maximo: int) -> int:
    crudo = os.environ.get(nombre, '')
    try:
        valor = int(crudo) if crudo else por_defecto
    except ValueError as e:
        raise ErrorDeConfiguracion(f'{nombre} debe ser un número') from e
    if not minimo <= valor <= maximo:
        raise ErrorDeConfiguracion(f'{nombre} debe estar entre {minimo} y {maximo}')
    return valor


def secreto(nombre: str) -> str:
    valor = os.environ.get(nombre, '')
    if len(valor) < 32 or valor.startswith('cambia-esto'):
        raise ErrorDeConfiguracion(f'{nombre} debe tener al menos 32 caracteres aleatorios (ver .env.example)')
    return valor
