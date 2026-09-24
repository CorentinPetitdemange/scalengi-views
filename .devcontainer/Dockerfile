FROM node:22.19.0-bookworm-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable \
  && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM rust:1.88-bookworm AS auth-builder

WORKDIR /build

COPY LICENSE ./LICENSE
COPY server/Cargo.toml server/Cargo.lock ./server/
COPY server/src ./server/src
RUN cargo build --release --locked --manifest-path server/Cargo.toml

FROM node:22.19.0-bookworm-slim AS runtime

LABEL org.opencontainers.image.source="https://github.com/CorentinPetitdemange/scalengi-views"
LABEL org.opencontainers.image.licenses="PolyForm-Shield-1.0.0"

ENV NODE_ENV="production"
ENV HOST="0.0.0.0"
ENV PORT="3001"

WORKDIR /app

RUN apt-get update \
  && apt-get install --yes --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data /tmp/nginx/client /tmp/nginx/fastcgi /tmp/nginx/proxy /tmp/nginx/scgi /tmp/nginx/uwsgi \
  && chown -R node:node /app/data /tmp/nginx

COPY --from=builder --chown=node:node /app/dist/standalone ./
COPY --from=auth-builder --chown=node:node /build/server/target/release/scalengi-views-auth ./scalengi-views-auth
COPY --chown=node:node .devcontainer/nginx.conf ./nginx.conf
COPY --chown=node:node .devcontainer/start-container.sh ./start-container.sh

USER node

EXPOSE 3000

HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=12 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r => { if (!r.ok || !(r.headers.get('content-type') || '').startsWith('text/html')) process.exit(1) }).catch(() => process.exit(1))"]

CMD ["bash", "./start-container.sh"]
