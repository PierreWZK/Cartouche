# Front : build Angular puis service nginx. nginx relaie /api vers le service « api » (voir nginx.conf).
# Lancé par Coolify (déploiement Dockerfile). Ta consigne : « On continue jusqu'à la fin ».
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/front/browser /usr/share/nginx/html
EXPOSE 80
