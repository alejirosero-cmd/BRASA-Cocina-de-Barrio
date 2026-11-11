"""
Bus de eventos en memoria para Server-Sent Events (SSE).
Funciona con un solo proceso del servidor (runserver o gunicorn con 1 worker y varios hilos);
para varias instancias habría que usar Redis o LISTEN/NOTIFY de PostgreSQL.
"""
import json
import queue
import threading
from typing import Callable, Iterator

from django.http import StreamingHttpResponse
from rest_framework.renderers import BaseRenderer, JSONRenderer


class RenderizadorEventos(BaseRenderer):
    """Permite que DRF acepte "Accept: text/event-stream" en las vistas de tiempo real."""

    media_type = 'text/event-stream'
    format = 'sse'
    charset = 'utf-8'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        # Solo se usa para respuestas de error (las exitosas son StreamingHttpResponse).
        return JSONRenderer().render(data)


RENDERIZADORES_SSE = [JSONRenderer, RenderizadorEventos]

_suscriptores: list[tuple[queue.Queue, Callable[[dict], bool]]] = []
_candado = threading.Lock()
LATIDO_SEGUNDOS = 25


def emitir(tipo: str, datos, pedido_id: str | None = None) -> None:
    evento = {'tipo': tipo, 'datos': datos, 'pedido_id': pedido_id}
    with _candado:
        for cola, filtro in list(_suscriptores):
            if filtro(evento):
                cola.put_nowait(evento)


def _flujo(filtro: Callable[[dict], bool]) -> Iterator[str]:
    cola: queue.Queue = queue.Queue(maxsize=500)
    with _candado:
        _suscriptores.append((cola, filtro))
    try:
        yield ': conectado\n\n'
        while True:
            try:
                evento = cola.get(timeout=LATIDO_SEGUNDOS)
            except queue.Empty:
                yield 'event: ping\ndata: \n\n'  # mantiene viva la conexión a través de proxies
                continue
            datos = json.dumps(evento['datos'], ensure_ascii=False, default=str)
            yield f'event: {evento["tipo"]}\ndata: {datos}\n\n'
    finally:
        with _candado:
            _suscriptores[:] = [s for s in _suscriptores if s[0] is not cola]


def respuesta_sse(filtro: Callable[[dict], bool]) -> StreamingHttpResponse:
    respuesta = StreamingHttpResponse(_flujo(filtro), content_type='text/event-stream')
    respuesta['Cache-Control'] = 'no-cache'
    respuesta['X-Accel-Buffering'] = 'no'  # Nginx no debe acumular el flujo
    return respuesta
