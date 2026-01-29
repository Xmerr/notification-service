ARG ELIXIR_VERSION=1.17.3
ARG OTP_VERSION=25.3.2.16
ARG ALPINE_VERSION=3.20.9

# ---- Build Stage ----
FROM hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-alpine-${ALPINE_VERSION} AS builder

RUN apk add --no-cache build-base git

WORKDIR /app

ENV MIX_ENV=prod

RUN mix local.hex --force && \
    mix local.rebar --force

COPY mix.exs mix.lock ./
RUN mix deps.get --only prod && \
    mix deps.compile

COPY config/config.exs config/prod.exs config/runtime.exs config/
COPY lib lib

RUN mix compile && \
    mix release

# ---- Runtime Stage ----
FROM alpine:${ALPINE_VERSION} AS runtime

RUN apk add --no-cache libstdc++ openssl ncurses-libs

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY --from=builder --chown=app:app /app/_build/prod/rel/notification_service ./

USER app

ENV PHX_SERVER=true

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["bin/notification_service", "pid"]

ENTRYPOINT ["bin/notification_service"]
CMD ["start"]
