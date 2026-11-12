import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { ApiService, mensajeError } from '../../core/services/api.service';
import { MesaService } from '../../core/services/mesa.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { ProductosService } from '../../core/services/productos.service';
import { TipoPedido } from '../../models/mesa.model';
import { PrecioCopPipe } from '../../shared/pipes/precio-cop.pipe';

interface Paso {
  titulo: string;
  descripcion: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, PrecioCopPipe],
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
                src="img/hero-hamburguesa.jpg"
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
              <!-- Dato real: promedio de las calificaciones; si aún no hay, el tamaño del menú. -->
              @if (resumen()?.promedio; as promedio) {
                <span class="font-heading text-2xl font-bold text-brasa-orange">{{ promedio }}</span>
                <span class="text-xs text-brasa-muted">★ {{ resumen()!.total }} {{ resumen()!.total === 1 ? 'opinión' : 'opiniones' }}</span>
              } @else {
                <span class="font-heading text-2xl font-bold text-brasa-orange">{{ productos.lista().length }}</span>
                <span class="text-xs text-brasa-muted">platos en el menú</span>
              }
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Categorías con foto: cada una abre el menú filtrado. -->
    <section class="mx-auto max-w-[1760px] px-5 pt-16 md:px-10 lg:pt-20 xl:px-20" aria-labelledby="titulo-categorias">
      <div class="flex items-end justify-between gap-4">
        <div>
          <h2 id="titulo-categorias" class="font-heading text-2xl font-bold tracking-tight text-brasa-black sm:text-3xl">
            Explora el menú
          </h2>
          <p class="mt-2 text-base text-brasa-muted">
            {{ productos.lista().length }} platos en {{ categoriasConFoto().length }} categorías, hechos al momento.
          </p>
        </div>
        <a routerLink="/menu" class="hidden shrink-0 text-sm font-semibold text-brasa-orange hover:text-brasa-orange-dark sm:inline">
          Ver todo el menú →
        </a>
      </div>

      <div class="sin-barra -mx-5 mt-8 flex snap-x scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        @for (c of categoriasConFoto(); track c.id) {
          <a
            [routerLink]="['/menu']"
            [queryParams]="{ categoria: c.id }"
            class="group relative block w-36 shrink-0 snap-start overflow-hidden rounded-2xl bg-brasa-black shadow-card md:w-auto"
          >
            <img
              [src]="c.foto"
              alt=""
              width="300"
              height="360"
              loading="lazy"
              class="aspect-[5/6] w-full object-cover opacity-90 md:aspect-[16/10] transition duration-300 group-hover:scale-105 group-hover:opacity-100"
            />
            <span class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" aria-hidden="true"></span>
            <span class="absolute inset-x-0 bottom-0 p-3">
              <span class="block font-heading text-sm font-semibold leading-tight text-white md:text-base">{{ c.nombre }}</span>
              <span class="text-xs text-white/75">{{ c.cantidad }} {{ c.cantidad === 1 ? 'plato' : 'platos' }}</span>
            </span>
          </a>
        }
      </div>
    </section>

    <!-- Los más vendidos: abren directamente el detalle para personalizar. -->
    <section class="mx-auto max-w-[1760px] px-5 pt-16 md:px-10 lg:pt-20 xl:px-20" aria-labelledby="titulo-favoritos">
      <h2 id="titulo-favoritos" class="font-heading text-2xl font-bold tracking-tight text-brasa-black sm:text-3xl">
        Los favoritos de la casa
      </h2>
      <p class="mt-2 text-base text-brasa-muted">Lo que más piden nuestros clientes.</p>

      <div class="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        @for (p of masVendidos(); track p.id) {
          <a
            [routerLink]="['/menu']"
            [queryParams]="{ producto: p.id }"
            class="group flex items-center gap-4 rounded-2xl border border-brasa-border bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"
          >
            <img
              [src]="p.imagenUrl"
              [alt]="p.nombre"
              width="112"
              height="112"
              loading="lazy"
              class="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28"
            />
            <span class="min-w-0 flex-1">
              <span class="block font-heading text-base font-semibold text-brasa-black">{{ p.nombre }}</span>
              <span class="mt-1 line-clamp-2 text-sm text-brasa-muted">{{ p.descripcion }}</span>
              <span class="mt-2 flex items-center justify-between gap-2">
                <span class="font-heading text-base font-bold text-brasa-black">{{ p.precio | precioCop }}</span>
                <span class="rounded-lg bg-brasa-orange/10 px-2.5 py-1 text-xs font-semibold text-brasa-orange transition group-hover:bg-brasa-orange group-hover:text-white">
                  Pedir
                </span>
              </span>
            </span>
          </a>
        }
      </div>
    </section>

    <!-- Cómo funciona, en tres pasos. -->
    <section class="mx-auto max-w-[1760px] px-5 py-16 md:px-10 lg:py-20 xl:px-20" aria-labelledby="titulo-pasos">
      <h2 id="titulo-pasos" class="font-heading text-2xl font-bold tracking-tight text-brasa-black sm:text-3xl">
        Así de fácil
      </h2>
      <p class="mt-2 text-base text-brasa-muted">Sin esperar la carta, sin levantar la mano y sin esperar la cuenta.</p>

      <ol class="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        @for (paso of pasos; track paso.titulo; let i = $index) {
          <li class="relative rounded-2xl border border-brasa-border bg-white p-6 shadow-card">
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-brasa-orange font-heading text-base font-bold text-white">
              {{ i + 1 }}
            </span>
            <h3 class="mt-4 font-heading text-lg font-semibold text-brasa-black">{{ paso.titulo }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-brasa-muted">{{ paso.descripcion }}</p>
          </li>
        }
      </ol>
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
        <!-- Ver el menú no exige mesa: el código solo se pide al enviar el pedido. -->
        <a
          routerLink="/menu"
          class="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brasa-orange px-7 py-4 font-heading text-base font-semibold text-white transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2 focus-visible:ring-offset-brasa-black"
        >
          Ver Menú
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </section>
  `,
})
export class HomeComponent {
  private readonly mesa = inject(MesaService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  protected readonly productos = inject(ProductosService);

  protected readonly pasos: Paso[] = [
    {
      titulo: 'Escanea el QR de tu mesa',
      descripcion: 'Cada mesa tiene su código. Tu pedido llega a cocina con el número de tu mesa.',
    },
    {
      titulo: 'Arma tu pedido a tu gusto',
      descripcion: 'Elige tamaño, extras y salsas, o quita ingredientes. Ves el precio antes de enviarlo.',
    },
    {
      titulo: 'Síguelo y paga desde el celular',
      descripcion: 'Mira cuando cocina lo prepara, llama al mesero si lo necesitas y paga sin esperar la cuenta.',
    },
  ];

  /** Categorías del menú con la foto de un producto representativo. */
  protected readonly categoriasConFoto = computed(() => {
    const lista = this.productos.lista();
    return this.productos
      .categorias()
      .filter((c) => c.id !== 'populares')
      .map((c) => {
        const deLaCategoria = lista.filter((p) => p.categoria === c.id);
        const foto = (deLaCategoria.find((p) => p.etiquetas.includes('mas-vendido')) ?? deLaCategoria[0])?.imagenUrl;
        return { id: c.id, nombre: c.nombre, cantidad: deLaCategoria.length, foto };
      })
      .filter((c) => c.cantidad > 0 && c.foto);
  });

  protected readonly masVendidos = computed(() =>
    this.productos.lista().filter((p) => p.etiquetas.includes('mas-vendido')).slice(0, 6),
  );

  /** Promedio real de calificaciones (si el servidor no responde, simplemente no se muestra). */
  protected readonly resumen = toSignal(
    this.api.get<{ promedio: number | null; total: number }>('/calificaciones/resumen').pipe(catchError(() => of(null))),
    { initialValue: null },
  );

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
