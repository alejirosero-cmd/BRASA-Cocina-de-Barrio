import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/** Agrega el token solo a las peticiones dirigidas a nuestra API (nunca a terceros). */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token;
  const esApi = req.url.startsWith(environment.apiUrl);
  const peticion = token && esApi ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    catchError((error: unknown) => {
      // Sesión vencida o revocada (cambio de rol, contraseña, usuario desactivado).
      if (error instanceof HttpErrorResponse && error.status === 401 && token && esApi && !req.url.endsWith('/auth/login')) {
        auth.cerrarSesion();
      }
      return throwError(() => error);
    }),
  );
};
