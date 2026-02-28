# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM elixir:1.17 AS builder

RUN apt-get update && apt-get install -y build-essential git && rm -rf /var/lib/apt/lists/*

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
FROM debian:12-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libstdc++6 \
    openssl \
    libncurses6 \
    locales && \
    rm -rf /var/lib/apt/lists/*

# Настройка локали для корректной работы Erlang
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US:en
ENV LC_ALL=en_US.UTF-8

WORKDIR /app

# Копируем только release из builder
COPY --from=builder /app/_build/prod/rel/chatforge ./

ENV HOME=/app
ENV MIX_ENV=prod

EXPOSE 4000

CMD ["bin/chatforge", "start"]
