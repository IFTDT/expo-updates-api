# syntax=docker/dockerfile:1.7

FROM node:20-slim AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ARG NPM_REGISTRY=https://registry.npmmirror.com/
RUN corepack enable \
  && npm config set registry ${NPM_REGISTRY} \
  && pnpm config set registry ${NPM_REGISTRY}

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd -r nodejs && useradd -r -g nodejs appuser

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY --from=build /app/src/db ./src/db
COPY --from=build /app/src/env.ts ./src/env.ts
COPY --from=build /app/code-signing ./code-signing
COPY --from=build /app/code-signing-keys ./code-signing-keys

# 用于本地文件存储的默认目录（如上传内容）
RUN mkdir -p /app/uploads && chown -R appuser:nodejs /app

USER appuser

EXPOSE 9999

CMD ["sh", "-c", "node ./node_modules/drizzle-kit/bin.cjs migrate && node dist/src/index.js"]
