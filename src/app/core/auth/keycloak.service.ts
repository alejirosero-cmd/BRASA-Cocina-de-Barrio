import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService, Usuario } from '../services/auth.service';

export interface ConfigKeycloak {
  url: string;
  realm: string;
  cliente: string;
}

const CLAVE_FLUJO = 'brasa.keycloak.flujo';

/** Datos temporales del flujo: se guardan antes de ir a Keycloak y se borran al volver. */
interface FlujoPendiente {
  estado: string;
  verificador: string;
  volver: string | null;
}

function aleatorio(bytes = 32): string {
  const datos = crypto.getRandomValues(new Uint8Array(bytes));
  return base64url(datos);
}

function base64url(datos: Uint8Array): string {
  return btoa(String.fromCharCode(...datos)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function retoPkce(verificador: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
  return base64url(new Uint8Array(hash));
}

/**
 * Inicio de sesión del personal con Keycloak: OpenID Connect, flujo Authorization Code + PKCE
 * (cliente público, sin secretos en el navegador). El token de Keycloak se canjea en el backend por una
 * sesión de BRASA, que verifica la firma y toma el rol del realm.
 */
@Injectable({ providedIn: 'root' })
export class KeycloakService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private config: Promise<ConfigKeycloak | null> | null = null;

  /** Configuración que publica el backend; null si Keycloak no está habilitado. */
  configuracion(): Promise<ConfigKeycloak | null> {
    this.config ??= firstValueFrom(this.api.get<{ keycloak: ConfigKeycloak | null }>('/auth/config'))
      .then((r) => r.keycloak)
      .catch(() => null);
    return this.config;
  }

  private urlRetorno(): string {
    return `${location.origin}/auth/keycloak`;
  }

  private base(c: ConfigKeycloak): string {
    return `${c.url}/realms/${encodeURIComponent(c.realm)}/protocol/openid-connect`;
  }

  async iniciar(volver: string | null): Promise<void> {
    const c = await this.configuracion();
    if (!c) throw new Error('El inicio de sesión con Keycloak no está habilitado');
    const flujo: FlujoPendiente = { estado: aleatorio(16), verificador: aleatorio(48), volver };
    sessionStorage.setItem(CLAVE_FLUJO, JSON.stringify(flujo));
    const params = new URLSearchParams({
      client_id: c.cliente,
      response_type: 'code',
      scope: 'openid email profile',
      redirect_uri: this.urlRetorno(),
      state: flujo.estado,
      code_challenge: await retoPkce(flujo.verificador),
      code_challenge_method: 'S256',
    });
    location.assign(`${this.base(c)}/auth?${params}`);
  }

  /** Completa el flujo al volver de Keycloak. Devuelve el usuario y la ruta a la que debe ir. */
  async completar(codigo: string, estado: string): Promise<{ usuario: Usuario; volver: string | null }> {
    const crudo = sessionStorage.getItem(CLAVE_FLUJO);
    sessionStorage.removeItem(CLAVE_FLUJO); // un solo uso
    const flujo = crudo ? (JSON.parse(crudo) as FlujoPendiente) : null;
    // El "state" protege contra ataques CSRF en el retorno.
    if (!flujo || flujo.estado !== estado) throw new Error('La respuesta de Keycloak no corresponde a este inicio de sesión');
    const c = await this.configuracion();
    if (!c) throw new Error('El inicio de sesión con Keycloak no está habilitado');

    const respuesta = await fetch(`${this.base(c)}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: c.cliente,
        code: codigo,
        redirect_uri: this.urlRetorno(),
        code_verifier: flujo.verificador,
      }),
    });
    if (!respuesta.ok) throw new Error('Keycloak rechazó el inicio de sesión. Intenta de nuevo.');
    const { access_token } = (await respuesta.json()) as { access_token: string };
    return { usuario: await this.auth.iniciarConKeycloak(access_token), volver: flujo.volver };
  }

  /** Cierra también la sesión única de Keycloak. */
  async cerrarSesionKeycloak(): Promise<void> {
    const c = await this.configuracion();
    if (!c) return;
    const params = new URLSearchParams({ client_id: c.cliente, post_logout_redirect_uri: `${location.origin}/login` });
    location.assign(`${this.base(c)}/logout?${params}`);
  }
}
