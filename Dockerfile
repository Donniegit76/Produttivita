# syntax=docker/dockerfile:1

# ---------- Stage 1: build di frontend e backend ----------
FROM node:22-bookworm-slim AS build

# strumenti necessari se better-sqlite3 non trova un binario precompilato
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci

COPY shared ./shared
COPY server ./server
COPY web ./web
RUN npm --workspace web run build \
  && npm --workspace server run build

# tiene solo le dipendenze di produzione per l'immagine finale
RUN npm prune --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/app/data \
    WEB_DIST_DIR=/app/web/dist \
    TZ=Europe/Rome

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist

# cartella dei dati (volume persistente) di proprietà dell'utente non privilegiato
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
