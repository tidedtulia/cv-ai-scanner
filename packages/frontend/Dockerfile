# Frontend image (azure-deploy AC-3). Build from the repo root:
#   docker build -f packages/frontend/Dockerfile --build-arg BACKEND_URL=http://backend -t cv-frontend .
# BACKEND_URL is where /api/* is proxied to: Next.js bakes it into its route table at BUILD time, so it is a build argument,
# and it is read again at run time by the server-side fetches. Both values must be the same.
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS build
ARG BACKEND_URL
ENV BACKEND_URL=${BACKEND_URL} NEXT_STANDALONE=true NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund
COPY . .
RUN test -n "$BACKEND_URL" || { echo "BACKEND_URL build argument is required (e.g. http://backend)" >&2; exit 1; }
WORKDIR /app/packages/frontend
RUN npx next build --webpack

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ARG BACKEND_URL
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 BACKEND_URL=${BACKEND_URL} PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/packages/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/packages/frontend/.next/static ./packages/frontend/.next/static
COPY --from=build --chown=node:node /app/packages/frontend/public ./packages/frontend/public
USER node
EXPOSE 3000
CMD ["node", "packages/frontend/server.js"]
