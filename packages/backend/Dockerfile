# Backend image (azure-deploy AC-2). Build from the repo root:  docker build -f packages/backend/Dockerfile -t cv-backend .
# Runs the API (`node dist/packages/backend/main.js`) and, with another command, the migrate + seed Job (scripts/migrate-and-seed.sh).
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund
COPY . .
# DATABASE_URL is not needed to generate the client or to bundle
RUN npx prisma generate --schema packages/backend/prisma/schema.prisma \
 && npx nx build @org/backend --skip-nx-cache

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && mkdir /app && chown node:node /app
WORKDIR /app
# Everything below is created by `node` (no `chown -R` afterwards: it would copy every file into a new layer)
USER node
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node packages/backend/package.json packages/backend/
COPY --chown=node:node packages/frontend/package.json packages/frontend/
COPY --chown=node:node packages/shared/package.json packages/shared/
# Production dependencies of the monorepo root plus the Prisma CLI (same version as the lockfile) for `migrate deploy` / `db seed`;
# then drop what only the frontend uses (next, react, sharp: ~400 MB) — npm would put them back on any later install
RUN npm ci --omit=dev --no-audit --no-fund \
 && npm install --no-save --no-audit --no-fund "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
 && rm -rf node_modules/next node_modules/@next node_modules/react node_modules/react-dom node_modules/react-markdown node_modules/@img \
 && npm cache clean --force
COPY --chown=node:node --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=build /app/dist/packages/backend ./dist/packages/backend
COPY --chown=node:node packages/backend/prisma ./packages/backend/prisma
COPY --chown=node:node packages/backend/prisma.config.ts ./packages/backend/prisma.config.ts
COPY --chown=node:node packages/backend/src/app/common/password.ts ./packages/backend/src/app/common/password.ts
COPY --chown=node:node packages/backend/scripts/migrate-and-seed.sh ./packages/backend/scripts/migrate-and-seed.sh
ENV PORT=3001
EXPOSE 3001
CMD ["node", "dist/packages/backend/main.js"]
