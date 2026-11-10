import { Component, computed, inject, signal } from '@angular/core';
import { mensajeError } from '../../core/services/api.service';
import { Router } from '@angular/router';
import { MesaService } from '../../core/services/mesa.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { TipoPedido } from '../../models/mesa.model';

interface Beneficio {
  titulo: string;
  descripcion: string;
}

@Component({
  selector: 'app-home',
  template: `
    <section class="relative overflow-hidden bg-brasa-gray-light">
      <div
        class="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brasa-orange/10 blur-3xl"
        aria-hidden="true"
      ></div>

      <div
        class="mx-auto grid max-w-[1760px] grid-cols-1 items-center gap-12 px-5 py-16 md:px-10 lg:grid-cols-12 lg:py-24 xl:px-20"
      >
        <div class="lg:col-span-6 xl:col-span-5">
          <span
            class="inline-flex items-center gap-2 rounded-full border border-brasa-orange/30 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brasa-orange"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            Cocina Artesanal
          </span>

          <h1
            class="mt-6 font-heading text-4xl font-bold leading-[1.1] tracking-tight text-brasa-black sm:text-5xl xl:text-6xl"
          >
            ¡Pide directo desde tu mesa
            <span class="text-brasa-orange">sin esperas!</span>
          </h1>

          <p class="mt-5 max-w-xl text-base leading-relaxed text-brasa-muted sm:text-lg">
            Escanea el código QR de tu mesa o pide para llevar. Arma tu pedido, personalízalo y
            envíalo a cocina en pocos toques.
          </p>

          <div
            class="mt-8 rounded-2xl border border-brasa-border bg-white p-5 shadow-soft sm:p-6"
            role="group"
            aria-label="Configura tu pedido"
          >
            <p class="text-sm font-semibold text-brasa-black">¿Cómo quieres tu pedido?</p>

            <div class="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                class="flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
                [class]="
                  tipo() === 'mesa'
                    ? 'border-brasa-orange bg-brasa-orange/5 text-brasa-black'
                    : 'border-brasa-border text-brasa-muted hover:border-brasa-muted'
                "
                [attr.aria-pressed]="tipo() === 'mesa'"
                (click)="seleccionarTipo('mesa')"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9" />
                </svg>
                En mesa
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange"
                [class]="
                  tipo() === 'llevar'
                    ? 'border-brasa-orange bg-brasa-orange/5 text-brasa-black'
                    : 'border-brasa-border text-brasa-muted hover:border-brasa-muted'
                "
                [attr.aria-pressed]="tipo() === 'llevar'"
                (click)="seleccionarTipo('llevar')"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0" />
                </svg>
                Para llevar
              </button>
            </div>

            @if (tipo() === 'mesa') {
              <div class="mt-4">
                <label for="mesa-inicio" class="mb-1.5 block text-sm font-medium text-brasa-black">
                  Código de tu mesa
                </label>
                @if (mesaActual()) {
                  <p class="mb-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                    Ya estás en la {{ mesaActual() }}. Puedes ver el menú o escribir otro código.
                  </p>
                }
                <div class="flex gap-3">
                  <div
                    class="flex flex-1 items-center gap-3 rounded-xl border border-brasa-border px-4 py-3 transition focus-within:border-brasa-orange focus-within:ring-2 focus-within:ring-brasa-orange/30"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-brasa-orange" aria-hidden="true">
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                    <input
                      id="mesa-inicio"
                      type="text"
                      autocomplete="off"
                      autocapitalize="characters"
                      maxlength="12"
                      aria-describedby="ayuda-mesa-inicio"
                      class="w-full bg-transparent text-sm font-medium uppercase tracking-widest text-brasa-black outline-none"
                      [value]="codigo()"
                      (input)="actualizarCodigo($event)"
                      (keydown.enter)="verMenu()"
                      placeholder="Ej. K7P2QXMA"
                    />
                  </div>
                </div>
                <p id="ayuda-mesa-inicio" class="mt-2 text-xs text-brasa-muted">Escanea el QR de tu mesa o escribe el código impreso debajo de él.</p>
                @if (error()) {
                  <p class="mt-2 text-xs font-medium text-red-600" role="alert">{{ error() }}</p>
                }
              </div>
            } @else {
              <p class="mt-4 flex items-center gap-2 rounded-xl bg-brasa-gray-light px-4 py-3 text-sm text-brasa-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-brasa-orange" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                </svg>
                Recoge tu pedido en el mostrador cuando esté listo.
              </p>
            }

            <button
              type="button"
              class="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brasa-orange px-6 py-4 font-heading text-base font-semibold text-white shadow-soft transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2"
              [disabled]="validando()"
              (click)="verMenu()"
            >
              {{ validando() ? 'Validando mesa...' : 'Ver Menú' }}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <div class="relative lg:col-span-6 lg:col-start-7 xl:col-span-7">
          <div class="relative mx-auto max-w-2xl">
            <div
              class="overflow-hidden rounded-3xl border border-brasa-border bg-white shadow-soft"
            >
              <img
                src="img/hero-burger.svg"
                alt="Hamburguesa BRASA acompañada de papas de la casa"
                width="900"
                height="720"
                class="h-auto w-full"
                loading="eager"
                fetchpriority="high"
              />
            </div>

            <div
              class="absolute -bottom-6 -left-4 hidden items-center gap-3 rounded-2xl border border-brasa-border bg-white p-4 shadow-soft sm:flex lg:-left-8"
            >
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brasa-orange/10 text-brasa-orange">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M12 2v8M4.93 10.93H15.07M2 18h20M6 18v-4M18 18v-4M12 20v-2" />
                  <path d="M20 6 12 2 4 6" />
                </svg>
              </span>
              <div>
                <p class="font-heading text-sm font-bold text-brasa-black">Listo en ~15 min</p>
                <p class="text-xs text-brasa-muted">Recién hecho en la parrilla</p>
              </div>
            </div>

            <div
              class="absolute -right-3 top-6 hidden flex-col items-center rounded-2xl border border-brasa-border bg-white px-4 py-3 shadow-soft md:flex lg:-right-6"
            >
              <span class="font-heading text-2xl font-bold text-brasa-orange">4.9</span>
              <span class="text-xs text-brasa-muted">★ valoración</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-[1760px] px-5 py-16 md:px-10 lg:py-20 xl:px-20">
      <div class="max-w-2xl">
        <h2 class="font-heading text-2xl font-bold tracking-tight text-brasa-black sm:text-3xl">
          Pedir desde la web tiene sus ventajas
        </h2>
        <p class="mt-3 text-base text-brasa-muted">
          Más rápido, más claro y a tu ritmo. Así funciona BRASA.
        </p>
      </div>

      <div class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        @for (beneficio of beneficios; track beneficio.titulo) {
          <article
            class="group rounded-2xl border border-brasa-border bg-white p-6 shadow-card transition hover:-translate-y-1 hover:shadow-soft"
          >
            <span
              class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brasa-orange/10 text-brasa-orange transition group-hover:bg-brasa-orange group-hover:text-white"
            >
              @switch (beneficio.titulo) {
                @case ('Sin esperas') {
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                  </svg>
                }
                @case ('Personaliza a tu gusto') {
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 3v18M3 12h18" />
                  </svg>
                }
                @default {
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                }
              }
            </span>
            <h3 class="font-heading text-lg font-semibold text-brasa-black">{{ beneficio.titulo }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-brasa-muted">{{ beneficio.descripcion }}</p>
          </article>
        }
      </div>
    </section>

    <section class="mx-auto max-w-[1760px] px-5 pb-20 md:px-10 xl:px-20">
      <div
        class="flex flex-col items-center gap-6 rounded-3xl bg-brasa-black px-8 py-12 text-center sm:px-12 lg:flex-row lg:justify-between lg:text-left"
      >
        <div>
          <h2 class="font-heading text-2xl font-bold text-white sm:text-3xl">
            ¿Listo para pedir?
          </h2>
          <p class="mt-2 text-sm text-white/70 sm:text-base">
            Explora el menú completo y arma tu pedido favorito.
          </p>
        </div>
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brasa-orange px-7 py-4 font-heading text-base font-semibold text-white transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2 focus-visible:ring-offset-brasa-black"
          (click)="verMenu()"
        >
          Ver Menú
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </section>
  `,
})
export class HomeComponent {
  private readonly mesa = inject(MesaService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);

  protected readonly beneficios: Beneficio[] = [
    {
      titulo: 'Sin esperas',
      descripcion:
        'Envía tu pedido directo a cocina y evita levantar la mano para ordenar.',
    },
    {
      titulo: 'Personaliza a tu gusto',
      descripcion:
        'Elige tamaño, extras, salsas y retira ingredientes antes de enviar tu pedido.',
    },
    {
      titulo: 'Todo bajo control',
      descripcion:
        'Sigue el estado de tu pedido y llama al mesero cuando lo necesites.',
    },
  ];

  protected readonly tipo = signal<TipoPedido>(this.mesa.tipo());
  protected readonly codigo = signal('');
  protected readonly error = signal('');
  protected readonly validando = signal(false);
  protected readonly mesaActual = computed(() => (this.mesa.codigo() ? this.mesa.etiqueta() : null));

  protected seleccionarTipo(tipo: TipoPedido): void {
    this.tipo.set(tipo);
    this.error.set('');
  }

  protected actualizarCodigo(evento: Event): void {
    this.codigo.set((evento.target as HTMLInputElement).value.trim().toUpperCase());
    this.error.set('');
  }

  protected async verMenu(): Promise<void> {
    if (this.tipo() === 'llevar') {
      this.mesa.paraLlevar();
      this.irAlMenu();
      return;
    }
    if (!this.codigo() && this.mesa.codigo()) {
      this.irAlMenu();
      return;
    }
    if (!/^[A-Z0-9]{6,12}$/.test(this.codigo())) {
      this.error.set('Escanea el QR de tu mesa o escribe el código impreso debajo de él.');
      return;
    }
    this.validando.set(true);
    try {
      await this.mesa.usarCodigo(this.codigo());
      this.irAlMenu();
    } catch (e) {
      this.error.set(mensajeError(e, 'No pudimos validar el código de la mesa.'));
    } finally {
      this.validando.set(false);
    }
  }

  private irAlMenu(): void {
    this.notificaciones.mostrar(`Pedido configurado: ${this.mesa.etiqueta()}`);
    this.router.navigate(['/menu']);
  }
}
