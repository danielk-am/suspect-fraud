FROM node:26-bookworm-slim AS build
WORKDIR /app
ENV ASTRO_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY astro.config.mjs ./
COPY src ./src
COPY public ./public
RUN npm run build && npm prune --omit=dev --ignore-scripts
FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production BIND_HOST=0.0.0.0 PORT=4321 OSINT_DB_PATH=/data/cases.sqlite OSINT_TOKEN_FILE=/run/secrets/osint_token
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node package.json ./
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=4s CMD node -e "require('node:http').get('http://127.0.0.1:4321/healthz',{headers:{host:new URL(process.env.PUBLIC_ORIGIN).host}},r=>{r.resume();process.exitCode=r.statusCode===200?0:1}).on('error',()=>process.exit(1))"
CMD ["node","server/index.mjs"]
