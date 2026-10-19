FROM node:22-bookworm-slim AS base
WORKDIR /server
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma/schema.prisma ./prisma/schema.prisma
# Client generation only; this placeholder never connects to a database.
RUN DATABASE_URL=postgresql://unused:unused@localhost:5432/unused npx prisma generate
COPY tsconfig.json ./
COPY src ./src
# Prisma declares its CLI as an optional peer; omit it along with dev tools.
RUN npm run build && npm prune --omit=dev --omit=optional

FROM base AS runtime
ENV NODE_ENV=production EXPRESS_SERVER_PORT=5000 UPLOAD_DIR=/server/uploads
COPY --from=build /server/package.json ./
COPY --from=build /server/node_modules ./node_modules
COPY --from=build /server/dist ./dist
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:5000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
# Migration tooling stays in development dependencies, outside this image.
CMD ["node", "dist/server.js"]
