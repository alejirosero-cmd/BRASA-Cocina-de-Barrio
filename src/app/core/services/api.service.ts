import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

type Parametros = HttpParams | Record<string, string | number | boolean>;

/** Cliente HTTP de la API de BRASA. La cabecera de sesión la agrega el interceptor. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  get<T>(endpoint: string, params?: Parametros, headers?: Record<string, string>): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, { params, headers: new HttpHeaders(headers ?? {}) });
  }

  post<T>(endpoint: string, body: unknown, headers?: Record<string, string>): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body, { headers: new HttpHeaders(headers ?? {}) });
  }

  patch<T>(endpoint: string, body: unknown, headers?: Record<string, string>): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${endpoint}`, body, { headers: new HttpHeaders(headers ?? {}) });
  }

  put<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body);
  }

  texto(endpoint: string): Promise<string> {
    return firstValueFrom(this.http.get(`${this.baseUrl}${endpoint}`, { responseType: 'text' }));
  }
}

/** Mensaje legible para el usuario a partir de un error HTTP (sin detalles internos). */
export function mensajeError(error: unknown, porDefecto = 'Ocurrió un error. Intenta de nuevo.'): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
    if (error.status === 429) return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
    const mensaje = error.error?.message;
    if (Array.isArray(mensaje)) return mensaje[0];
    if (typeof mensaje === 'string' && error.status < 500) return mensaje;
    if (error.status >= 500) return 'El servidor tuvo un problema. Intenta de nuevo en unos minutos.';
  }
  return porDefecto;
}
