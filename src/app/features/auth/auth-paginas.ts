import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { mensajeError } from '../../core/services/api.service';
import { AuthService, INICIO_POR_ROL } from '../../core/services/auth.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';

const CAMPO =
  'w-full rounded-xl border border-brasa-border px-4 py-3 text-sm outline-none transition focus:border-brasa-orange focus:ring-2 focus:ring-brasa-orange/30';
const BOTON =
  'flex w-full items-center justify-center rounded-xl bg-brasa-orange px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-brasa-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brasa-orange focus-visible:ring-offset-2 disabled:opacity-60';
const TARJETA = 'mx-auto my-12 w-full max-w-md rounded-2xl border border-brasa-border bg-white p-8 shadow-soft';

/** Solo se permite volver a rutas internas (evita redirecciones abiertas). */
function rutaSegura(valor: string | undefined): string | null {
  return valor && valor.startsWith('/') && !valor.startsWith('//') ? valor : null;
}

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="px-5">
      <form class="${TARJETA}" (ngSubmit)="enviar()" #f="ngForm">
        <h1 class="font-heading text-2xl font-bold text-brasa-black">Iniciar sesión</h1>
        <p class="mt-1 text-sm text-brasa-muted">Clientes, meseros, cocina y administración.</p>
        <label class="mt-6 block space-y-1 text-sm">
          <span class="font-medium">Correo electrónico</span>
          <input class="${CAMPO}" type="email" name="email" autocomplete="username" required [(ngModel)]="email" />
        </label>
        <label class="mt-4 block space-y-1 text-sm">
          <span class="font-medium">Contraseña</span>
          <input class="${CAMPO}" type="password" name="password" autocomplete="current-password" required [(ngModel)]="password" />
        </label>
        @if (error()) {
          <p class="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error() }}</p>
        }
        <button class="${BOTON} mt-6" type="submit" [disabled]="enviando() || f.invalid">{{ enviando() ? 'Ingresando...' : 'Ingresar' }}</button>
        <div class="mt-5 flex justify-between text-sm">
          <a routerLink="/recuperar" class="text-brasa-muted hover:text-brasa-orange">¿Olvidaste tu contraseña?</a>
          <a routerLink="/registro" class="font-semibold text-brasa-orange">Crear cuenta</a>
        </div>
      </form>
    </section>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly volver = input<string>();

  protected email = '';
  protected password = '';
  protected readonly enviando = signal(false);
  protected readonly error = signal('');

  protected async enviar(): Promise<void> {
    this.enviando.set(true);
    this.error.set('');
    try {
      const usuario = await this.auth.iniciarSesion(this.email, this.password);
      this.password = '';
      this.router.navigateByUrl(rutaSegura(this.volver()) ?? INICIO_POR_ROL[usuario.rol]);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}

@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="px-5">
      <form class="${TARJETA}" (ngSubmit)="enviar()" #f="ngForm">
        <h1 class="font-heading text-2xl font-bold text-brasa-black">Crea tu cuenta</h1>
        <p class="mt-1 text-sm text-brasa-muted">Guarda tu historial de pedidos en cualquier dispositivo. Es opcional: también puedes pedir sin cuenta.</p>
        <label class="mt-6 block space-y-1 text-sm">
          <span class="font-medium">Nombre</span>
          <input class="${CAMPO}" name="nombre" autocomplete="name" required minlength="2" maxlength="80" [(ngModel)]="nombre" />
        </label>
        <label class="mt-4 block space-y-1 text-sm">
          <span class="font-medium">Correo electrónico</span>
          <input class="${CAMPO}" type="email" name="email" autocomplete="email" required [(ngModel)]="email" />
        </label>
        <label class="mt-4 block space-y-1 text-sm">
          <span class="font-medium">Contraseña</span>
          <input class="${CAMPO}" type="password" name="password" autocomplete="new-password" required minlength="10" maxlength="128" aria-describedby="ayuda-clave" [(ngModel)]="password" />
          <span id="ayuda-clave" class="block text-xs text-brasa-muted">Mínimo 10 caracteres. Una frase fácil de recordar es más segura que una palabra con símbolos.</span>
        </label>
        <label class="mt-4 flex items-start gap-3 text-xs text-brasa-muted">
          <input type="checkbox" name="acepta" class="mt-0.5 h-4 w-4 accent-brasa-orange" required [(ngModel)]="acepta" />
          Autorizo el tratamiento de mis datos (nombre y correo) para gestionar mi cuenta y mis pedidos, conforme a la Ley 1581 de 2012.
        </label>
        @if (error()) {
          <p class="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error() }}</p>
        }
        <button class="${BOTON} mt-6" type="submit" [disabled]="enviando() || f.invalid">{{ enviando() ? 'Creando cuenta...' : 'Crear cuenta' }}</button>
        <p class="mt-5 text-center text-sm text-brasa-muted">¿Ya tienes cuenta? <a routerLink="/login" class="font-semibold text-brasa-orange">Inicia sesión</a></p>
      </form>
    </section>
  `,
})
export class RegistroComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionesService);

  protected nombre = '';
  protected email = '';
  protected password = '';
  protected acepta = false;
  protected readonly enviando = signal(false);
  protected readonly error = signal('');

  protected async enviar(): Promise<void> {
    this.enviando.set(true);
    this.error.set('');
    try {
      await this.auth.registrar(this.nombre, this.email, this.password);
      this.password = '';
      this.notificaciones.mostrar('¡Bienvenido a BRASA!');
      this.router.navigate(['/menu']);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}

@Component({
  selector: 'app-recuperar',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="px-5">
      <form class="${TARJETA}" (ngSubmit)="enviar()" #f="ngForm">
        <h1 class="font-heading text-2xl font-bold text-brasa-black">Recuperar contraseña</h1>
        <p class="mt-1 text-sm text-brasa-muted">Te enviaremos un enlace válido por 30 minutos.</p>
        @if (mensaje()) {
          <p class="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700" role="status">{{ mensaje() }}</p>
        } @else {
          <label class="mt-6 block space-y-1 text-sm">
            <span class="font-medium">Correo electrónico</span>
            <input class="${CAMPO}" type="email" name="email" autocomplete="email" required [(ngModel)]="email" />
          </label>
          @if (error()) {
            <p class="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error() }}</p>
          }
          <button class="${BOTON} mt-6" type="submit" [disabled]="enviando() || f.invalid">Enviar enlace</button>
        }
        <p class="mt-5 text-center text-sm"><a routerLink="/login" class="text-brasa-muted hover:text-brasa-orange">Volver a iniciar sesión</a></p>
      </form>
    </section>
  `,
})
export class RecuperarComponent {
  private readonly auth = inject(AuthService);
  protected email = '';
  protected readonly enviando = signal(false);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');

  protected async enviar(): Promise<void> {
    this.enviando.set(true);
    this.error.set('');
    try {
      this.mensaje.set(await this.auth.solicitarRecuperacion(this.email));
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}

@Component({
  selector: 'app-restablecer',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="px-5">
      <form class="${TARJETA}" (ngSubmit)="enviar()" #f="ngForm">
        <h1 class="font-heading text-2xl font-bold text-brasa-black">Nueva contraseña</h1>
        @if (mensaje()) {
          <p class="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700" role="status">{{ mensaje() }}</p>
          <a routerLink="/login" class="${BOTON} mt-6">Iniciar sesión</a>
        } @else {
          <label class="mt-6 block space-y-1 text-sm">
            <span class="font-medium">Nueva contraseña</span>
            <input class="${CAMPO}" type="password" name="password" autocomplete="new-password" required minlength="10" maxlength="128" [(ngModel)]="password" />
          </label>
          <label class="mt-4 block space-y-1 text-sm">
            <span class="font-medium">Confirmar contraseña</span>
            <input class="${CAMPO}" type="password" name="confirmacion" autocomplete="new-password" required [(ngModel)]="confirmacion" />
          </label>
          @if (error()) {
            <p class="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error() }}</p>
          }
          <button class="${BOTON} mt-6" type="submit" [disabled]="enviando() || f.invalid || !token()">Guardar contraseña</button>
          @if (!token()) {
            <p class="mt-4 text-sm text-red-700">El enlace no es válido. Solicita uno nuevo.</p>
          }
        }
      </form>
    </section>
  `,
})
export class RestablecerComponent {
  private readonly auth = inject(AuthService);
  readonly token = input<string>('');
  protected password = '';
  protected confirmacion = '';
  protected readonly enviando = signal(false);
  protected readonly mensaje = signal('');
  protected readonly error = signal('');

  protected async enviar(): Promise<void> {
    if (this.password !== this.confirmacion) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    try {
      this.mensaje.set(await this.auth.restablecer(this.token(), this.password));
      // Quita el token de la barra de direcciones y del historial del navegador.
      history.replaceState(null, '', '/restablecer');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}

@Component({
  selector: 'app-cuenta',
  imports: [FormsModule],
  template: `
    <section class="px-5">
      <form class="${TARJETA}" (ngSubmit)="cambiar()" #f="ngForm">
        <h1 class="font-heading text-2xl font-bold text-brasa-black">Mi cuenta</h1>
        <p class="mt-1 text-sm text-brasa-muted">{{ auth.usuario()?.nombre }} · {{ auth.usuario()?.email }}</p>
        <h2 class="mt-6 font-heading text-base font-semibold">Cambiar contraseña</h2>
        <label class="mt-3 block space-y-1 text-sm">
          <span class="font-medium">Contraseña actual</span>
          <input class="${CAMPO}" type="password" name="actual" autocomplete="current-password" required [(ngModel)]="actual" />
        </label>
        <label class="mt-4 block space-y-1 text-sm">
          <span class="font-medium">Nueva contraseña</span>
          <input class="${CAMPO}" type="password" name="nueva" autocomplete="new-password" required minlength="10" maxlength="128" [(ngModel)]="nueva" />
        </label>
        @if (error()) {
          <p class="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{{ error() }}</p>
        }
        <button class="${BOTON} mt-6" type="submit" [disabled]="enviando() || f.invalid">Actualizar contraseña</button>
        <p class="mt-3 text-xs text-brasa-muted">Al cambiarla se cerrarán tus sesiones en otros dispositivos.</p>
        <button type="button" class="mt-6 w-full rounded-xl border border-brasa-border px-6 py-3 text-sm font-semibold" (click)="auth.cerrarSesion()">Cerrar sesión</button>
      </form>
    </section>
  `,
})
export class CuentaComponent {
  protected readonly auth = inject(AuthService);
  private readonly notificaciones = inject(NotificacionesService);
  protected actual = '';
  protected nueva = '';
  protected readonly enviando = signal(false);
  protected readonly error = signal('');

  protected async cambiar(): Promise<void> {
    this.enviando.set(true);
    this.error.set('');
    try {
      await this.auth.cambiarPassword(this.actual, this.nueva);
      this.actual = '';
      this.nueva = '';
      this.notificaciones.mostrar('Contraseña actualizada');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
