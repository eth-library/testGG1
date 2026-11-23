# Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Auslieferung (statisch, z. B. Cloud Run)
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Die Laufzeit-Konfiguration wird pro Umgebung bereitgestellt (Volume/Secret):
#   /usr/share/nginx/html/config/config.json
# Fehlt sie, startet die App mit config.example.json im Demo-Modus.
EXPOSE 8080
