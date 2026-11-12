# Frontend de BRASA: se compila Angular y se sirve con Nginx (que además redirige /api al backend).

# --- Etapa 1: compilación ---
FROM node:24-alpine AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY angular.json tsconfig*.json .postcssrc.json ngsw-config.json ./
COPY public ./public
COPY src ./src
RUN npx ng build --configuration production

# --- Etapa 2: servidor web ---
FROM nginx:1.29-alpine
# Plantilla: al arrancar, Nginx reemplaza ${KEYCLOAK_ORIGEN} (dirección de Keycloak permitida por la CSP).
ENV KEYCLOAK_ORIGEN=http://localhost:8089
COPY nginx/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=compilacion /app/dist/brasa-cocina-de-barrio/browser /usr/share/nginx/html
EXPOSE 80
