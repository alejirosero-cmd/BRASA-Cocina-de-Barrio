import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { TiempoRealService } from './tiempo-real.service';

describe('TiempoRealService (lectura de eventos SSE)', () => {
  it('interpreta bloques "event:/data:" con JSON', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    const servicio = TestBed.inject(TiempoRealService) as unknown as { interpretar(b: string): unknown };
    expect(servicio.interpretar('event: pedido.actualizado\nid: 1\ndata: {"id":"abc","estado":"LISTO"}')).toEqual({
      tipo: 'pedido.actualizado',
      datos: { id: 'abc', estado: 'LISTO' },
    });
    expect(servicio.interpretar(': comentario')).toBeNull();
  });
});
