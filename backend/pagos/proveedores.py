"""
Proveedores de pago.
- Wompi (Bancolombia), docs.wompi.co:
  * Checkout web con firma de integridad: SHA256(referencia + montoEnCentavos + moneda + secretoIntegridad).
  * Eventos: SHA256(valores de signature.properties + timestamp + secretoEventos) == signature.checksum.
- Simulado: no mueve dinero; prohibido en producción (ver settings).
"""
import logging
import re
from dataclasses import dataclass
from urllib.parse import urlencode

import requests
from django.conf import settings

from nucleo.seguridad import iguales, sha256

logger = logging.getLogger('brasa')

ESTADOS_WOMPI = {'APPROVED': 'APROBADO', 'DECLINED': 'RECHAZADO', 'VOIDED': 'ANULADO', 'ERROR': 'ERROR', 'PENDING': 'PENDIENTE'}


@dataclass
class ResultadoVerificado:
    clave_idempotencia: str
    referencia: str
    transaccion_id: str
    estado: str
    monto_centavos: int
    moneda: str
    metodo: str | None
    tipo: str
    payload: object


def _leer_ruta(objeto, ruta: str):
    for clave in ruta.split('.'):
        objeto = objeto.get(clave) if isinstance(objeto, dict) else None
    return objeto


class ProveedorWompi:
    nombre = 'wompi'

    def __init__(self, config: dict | None = None):
        self.w = config or settings.WOMPI

    def firma_integridad(self, referencia: str, monto_centavos: int, moneda: str = 'COP') -> str:
        return sha256(f'{referencia}{monto_centavos}{moneda}{self.w["integrity_secret"]}')

    def url_checkout(self, referencia: str, monto: int, url_retorno: str) -> str:
        centavos = monto * 100
        params = {
            'public-key': self.w['public_key'], 'currency': 'COP', 'amount-in-cents': str(centavos),
            'reference': referencia, 'signature:integrity': self.firma_integridad(referencia, centavos),
            'redirect-url': url_retorno,
        }
        return f'{self.w["checkout_url"]}?{urlencode(params)}'

    def verificar_webhook(self, cuerpo) -> ResultadoVerificado | None:
        """Devuelve None si la firma no es válida."""
        if not isinstance(cuerpo, dict):
            return None
        firma = cuerpo.get('signature') or {}
        propiedades, checksum = firma.get('properties'), firma.get('checksum')
        tx = (cuerpo.get('data') or {}).get('transaction')
        if not isinstance(propiedades, list) or not isinstance(checksum, str) or not tx or 'timestamp' not in cuerpo:
            return None
        datos = cuerpo.get('data')
        valores = ''.join('' if _leer_ruta(datos, str(p)) is None else str(_leer_ruta(datos, str(p))) for p in propiedades)
        if not iguales(sha256(f'{valores}{cuerpo["timestamp"]}{self.w["events_secret"]}'), checksum.lower()):
            logger.warning('Evento de Wompi con firma inválida (referencia %s)', tx.get('reference'))
            return None
        return self._normalizar(tx, f'wompi:{tx.get("id")}:{tx.get("status")}:{cuerpo["timestamp"]}',
                                cuerpo.get('event', 'transaction.updated'), cuerpo)

    def consultar_transaccion(self, transaccion_id: str) -> ResultadoVerificado | None:
        """Consulta el estado directamente al proveedor (no confía en datos del navegador)."""
        if not re.fullmatch(r'[\w-]{5,64}', transaccion_id or ''):
            return None
        respuesta = requests.get(f'{self.w["api_url"]}/transactions/{transaccion_id}',
                                 headers={'Authorization': f'Bearer {self.w["private_key"]}'}, timeout=10)
        if not respuesta.ok:
            logger.warning('Wompi respondió %s al consultar %s', respuesta.status_code, transaccion_id)
            return None
        tx = respuesta.json().get('data')
        if not tx:
            return None
        return self._normalizar(tx, f'wompi:{tx.get("id")}:{tx.get("status")}:consulta', 'consulta', respuesta.json())

    def _normalizar(self, tx: dict, clave: str, tipo: str, payload) -> ResultadoVerificado | None:
        estado = ESTADOS_WOMPI.get(tx.get('status'))
        if not estado:
            return None
        return ResultadoVerificado(clave, tx.get('reference'), tx.get('id'), estado, tx.get('amount_in_cents'),
                                   tx.get('currency'), tx.get('payment_method_type'), tipo, payload)


class ProveedorSimulado:
    """La "pasarela" es una página del propio frontend (/pago/simulado) para aprobar o rechazar."""

    nombre = 'simulado'

    def url_checkout(self, referencia: str, monto: int, url_retorno: str) -> str:
        return f'{settings.FRONTEND_URL}/pago/simulado?{urlencode({"ref": referencia, "monto": monto, "retorno": url_retorno})}'

    def verificar_webhook(self, cuerpo):
        return None

    def consultar_transaccion(self, transaccion_id):
        return None

    def resultado(self, referencia: str, monto: int, aprobar: bool) -> ResultadoVerificado:
        estado = 'APROBADO' if aprobar else 'RECHAZADO'
        return ResultadoVerificado(f'simulado:{referencia}:{estado}', referencia, f'SIM-{referencia}', estado,
                                   monto * 100, 'COP', 'SIMULADO', 'simulado', {'referencia': referencia, 'aprobar': aprobar})


def proveedor_actual():
    return ProveedorWompi() if settings.PAGOS_PROVEEDOR == 'wompi' else ProveedorSimulado()
