import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, mensajeError } from '../../core/services/api.service';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

/**
 * Pasarela de pruebas (PAGOS_PROVEEDOR=simulado). No mueve dinero; el servidor la desactiva
 * en producción. Sirve para probar el flujo completo sin llaves de Wompi.
 */
@Component({
  selector: 'app-pago-simulado',
  imports: [PrecioCopPipe],
  template: `
    <section class="mx-auto max-w-md px-5 py-16">
      <div class="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-8 text-center">
        <p class="text-xs font-semibold uppercase tracking-widest text-amber-700">Pasarela de pruebas</p>
        <h1 class="mt-2 font-heading text-2xl font-bold text-brasa-black">{{ monto() | precioCop }}</h1>
        <p class="mt-1 break-all text-xs text-brasa-muted">Referencia {{ ref() }}</p>
        <p class="mt-4 text-sm text-amber-800">No se cobra dinero real. Elige el resultado que quieres simular.</p>
        @if (error()) {
          <p class="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error() }}</p>
        }
        <div class="mt-6 flex gap-3">
          <button type="button" class="flex-1 rounded-xl border border-brasa-border bg-white px-4 py-3 text-sm font-semibold" [disabled]="enviando()" (click)="responder(false)">Rechazar</button>
          <button type="button" class="flex-1 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white" [disabled]="enviando()" (click)="responder(true)">Aprobar</button>
        </div>
      </div>
    </section>
  `,
})
export class PagoSimuladoComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly ref = input<string>('');
  readonly monto = input<number, string>(0, { transform: Number });
  readonly retorno = input<string>('');

  protected readonly enviando = signal(false);
  protected readonly error = signal('');

  protected async responder(aprobar: boolean): Promise<void> {
    this.enviando.set(true);
    try {
      const r = await firstValueFrom(this.api.post<{ pedidoId: string }>(`/pagos/simulado/${encodeURIComponent(this.ref())}`, { aprobar }));
      // Evita redirecciones abiertas: solo se vuelve a una ruta del propio sitio.
      const destino = new URL(this.retorno() || '/', location.origin);
      if (destino.origin === location.origin) {
        this.router.navigateByUrl(destino.pathname + destino.search);
      } else {
        this.router.navigate(['/pedido', r.pedidoId]);
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
