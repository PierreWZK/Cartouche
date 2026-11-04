# API : compilation TypeScript puis image d'exécution sans outils de développement.
# Lancé par Coolify. Variables attendues : RAWG_API_KEY, IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, DATABASE_URL, CORS_ORIGIN.
# Ta consigne : « On continue jusqu'à la fin ».
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
