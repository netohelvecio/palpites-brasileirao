# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /repo

# All deps (incl dev) pra build.
# packages/shared inteiro é copiado aqui porque o `prepare: tsc` script roda no
# pnpm install e precisa do src+tsconfig pra produzir dist/.
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared packages/shared
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Compila a API (shared/dist já foi gerado pelo `prepare` script no estágio deps)
FROM deps AS builder
COPY apps/api apps/api
RUN pnpm --filter @palpites/api build

# Apenas prod deps na mesma estrutura de workspace.
# --ignore-scripts pula o `prepare` (não precisa rebuildar shared aqui — vem do builder).
FROM base AS prod-deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile --ignore-scripts

# Imagem final
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
RUN apk add --no-cache curl tini
WORKDIR /app

# Estrutura mínima do workspace pra que symlinks de @palpites/shared resolvam
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=node:node /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder --chown=node:node /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=node:node /repo/apps/api/build ./apps/api/build
COPY --from=builder --chown=node:node /repo/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api/build
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:3333/health || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "bin/server.js"]
