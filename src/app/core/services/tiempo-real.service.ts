import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface EventoServidor {
  tipo: string;
  datos: unknown;
}

/**
 * Cliente de Server-Sent Events basado en fetch. Se usa fetch (y no EventSource) para poder
 * enviar el token en una cabecera en vez de ponerlo en la URL, donde quedaría en registros.
 * Se reconecta automáticamente con espera creciente si la conexión se corta.
 */
@Injectable({ providedIn: 'root' })
export class TiempoRealService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  escuchar(ruta: string, cabeceras: Record<string, string> = {}): Observable<EventoServidor> {
    return new Observable<EventoServidor>((suscriptor) => {
      let control = new AbortController();
      let cerrado = false;
      let espera = 1000;
      let temporizador: ReturnType<typeof setTimeout> | undefined;

      const conectar = async () => {
        control = new AbortController();
        const headers: Record<string, string> = { Accept: 'text/event-stream', ...cabeceras };
        if (this.auth.token) headers['Authorization'] = `Bearer ${this.auth.token}`;
        try {
          const respuesta = await fetch(`${this.api.baseUrl}${ruta}`, { headers, signal: control.signal });
          if (respuesta.status === 401 || respuesta.status === 403 || respuesta.status === 404) {
            suscriptor.error(new Error(`Sin acceso al canal en tiempo real (${respuesta.status})`));
            return;
          }
          if (!respuesta.ok || !respuesta.body) throw new Error(`HTTP ${respuesta.status}`);
          espera = 1000;
          suscriptor.next({ tipo: 'conectado', datos: null });

          const lector = respuesta.body.pipeThrough(new TextDecoderStream()).getReader();
          let bufer = '';
          for (;;) {
            const { value, done } = await lector.read();
            if (done) break;
            bufer += value;
            let corte: number;
            while ((corte = bufer.indexOf('\n\n')) >= 0) {
              const bloque = bufer.slice(0, corte);
              bufer = bufer.slice(corte + 2);
              const evento = this.interpretar(bloque);
              if (evento && evento.tipo !== 'ping') suscriptor.next(evento);
            }
          }
        } catch {
          if (cerrado) return;
        }
        if (!cerrado) {
          suscriptor.next({ tipo: 'desconectado', datos: null });
          temporizador = setTimeout(conectar, espera);
          espera = Math.min(espera * 2, 30_000);
        }
      };

      conectar();
      return () => {
        cerrado = true;
        clearTimeout(temporizador);
        control.abort();
      };
    });
  }

  private interpretar(bloque: string): EventoServidor | null {
    let tipo = 'message';
    const datos: string[] = [];
    for (const linea of bloque.split('\n')) {
      if (linea.startsWith('event:')) tipo = linea.slice(6).trim();
      else if (linea.startsWith('data:')) datos.push(linea.slice(5).trimStart());
    }
    if (datos.length === 0) return null;
    const texto = datos.join('\n');
    try {
      return { tipo, datos: texto ? JSON.parse(texto) : null };
    } catch {
      return { tipo, datos: texto };
    }
  }
}
