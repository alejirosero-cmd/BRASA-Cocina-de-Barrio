/**
 * Producción: el frontend y la API se sirven desde el mismo dominio (la API en /api).
 * Si se despliegan en dominios distintos, cambia apiUrl y FRONTEND_URL en el servidor.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
};
