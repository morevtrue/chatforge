# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM elixir:1.17-alpine AS builder

RUN apk add --no-cache build-base git

WORKDIR /app

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV=prod

# Зависимости (кешируем отдельным слоем)
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod && mix deps.compile

# Исходники
COPY config config
COPY lib lib
COPY priv priv

# Компилируем и собираем release
RUN mix compile
RUN mix release

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM alpine:3.20 AS runtime

RUN apk add --no-cache libstdc++ openssl ncurses-libs

WORKDIR /app

# Копируем только release из builder
COPY --from=builder /app/_build/prod/rel/chatforge ./

ENV HOME=/app
ENV MIX_ENV=prod

EXPOSE 4000

CMD ["bin/chatforge", "start"]
