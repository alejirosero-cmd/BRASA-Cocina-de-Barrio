import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export type Rol = 'ADMIN' | 'CLIENTE' | 'MESERO' | 'COCINA';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

interface Sesion {
  token: string;
  usuario: Usuario;
}

/**
 * La sesión se guarda en sessionStorage: se cierra al cerrar la pestaña y no se comparte entre
 * pestañas. Los permisos reales los valida siempre el servidor; aquí solo se adapta la interfaz.
 */
const CLAVE = 'brasa.sesion';

/** Pantalla de inicio de cada rol después de iniciar sesión. */
export const INICIO_POR_ROL: Record<Rol, string> = {
  ADMIN: '/admin',
  COCINA: '/cocina',
  MESERO: '/mesero',
  CLIENTE: '/menu',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly sesion = signal<Sesion | null>(this.cargar());

  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly autenticado = computed(() => this.sesion() !== null);
  readonly rol = computed(() => this.sesion()?.usuario.rol ?? null);
  readonly esPersonal = computed(() => ['ADMIN', 'MESERO', 'COCINA'].includes(this.rol() ?? ''));

  get token(): string | null {
    return this.sesion()?.token ?? null;
  }

  tieneRol(...roles: Rol[]): boolean {
    const rol = this.rol();
    return rol !== null && roles.includes(rol);
  }

  async iniciarSesion(email: string, password: string): Promise<Usuario> {
    return this.guardar(await firstValueFrom(this.api.post<Sesion>('/auth/login', { email, password })));
  }

  async registrar(nombre: string, email: string, password: string): Promise<Usuario> {
    return this.guardar(await firstValueFrom(this.api.post<Sesion>('/auth/registro', { nombre, email, password })));
  }

  async solicitarRecuperacion(email: string): Promise<string> {
    const r = await firstValueFrom(this.api.post<{ mensaje: string }>('/auth/recuperar', { email }));
    return r.mensaje;
  }

  async restablecer(token: string, password: string): Promise<string> {
    const r = await firstValueFrom(this.api.post<{ mensaje: string }>('/auth/restablecer', { token, password }));
    return r.mensaje;
  }

  async cambiarPassword(actual: string, nueva: string): Promise<void> {
    this.guardar(await firstValueFrom(this.api.post<Sesion>('/auth/cambiar-password', { actual, nueva })));
  }

  cerrarSesion(redirigir = true): void {
    this.sesion.set(null);
    try {
      sessionStorage.removeItem(CLAVE);
    } catch {
      /* almacenamiento no disponible */
    }
    if (redirigir) this.router.navigate(['/login']);
  }

  private guardar(sesion: Sesion): Usuario {
    this.sesion.set(sesion);
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(sesion));
    } catch {
      /* almacenamiento no disponible: la sesión dura lo que dure la página */
    }
    return sesion.usuario;
  }

  private cargar(): Sesion | null {
    try {
      const crudo = sessionStorage.getItem(CLAVE);
      if (!crudo) return null;
      const s = JSON.parse(crudo) as Sesion;
      return typeof s?.token === 'string' && typeof s?.usuario?.rol === 'string' ? s : null;
    } catch {
      return null;
    }
  }
}
