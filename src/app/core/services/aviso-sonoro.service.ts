import { Injectable, signal } from '@angular/core';

const CLAVE = 'brasa.sonido';

/**
 * Timbre corto (dos tonos) generado con Web Audio, sin archivos de sonido.
 * Los navegadores solo dejan sonar audio después de un toque del usuario, por eso el sonido se
 * activa con un botón y la preferencia se recuerda en este equipo.
 */
@Injectable({ providedIn: 'root' })
export class AvisoSonoroService {
  readonly activo = signal(this.leer());
  private contexto?: AudioContext;

  alternar(): void {
    this.activo.set(!this.activo());
    try {
      localStorage.setItem(CLAVE, this.activo() ? '1' : '0');
    } catch {
      /* almacenamiento no disponible */
    }
    if (this.activo()) this.sonar(); // prueba inmediata, y desbloquea el audio con este toque
  }

  sonar(): void {
    if (!this.activo()) return;
    try {
      this.contexto ??= new AudioContext();
      const ctx = this.contexto;
      if (ctx.state === 'suspended') void ctx.resume();
      [880, 1175].forEach((frecuencia, i) => {
        const inicio = ctx.currentTime + i * 0.18;
        const osc = ctx.createOscillator();
        const volumen = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = frecuencia;
        volumen.gain.setValueAtTime(0.0001, inicio);
        volumen.gain.exponentialRampToValueAtTime(0.25, inicio + 0.02);
        volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.16);
        osc.connect(volumen).connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + 0.17);
      });
    } catch {
      /* el navegador no permite audio: el aviso visual sigue funcionando */
    }
  }

  private leer(): boolean {
    try {
      return localStorage.getItem(CLAVE) === '1';
    } catch {
      return false;
    }
  }
}
