# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Overview

Elixir notification service that consumes messages from the `notifications` RabbitMQ exchange and routes them to Discord channels via webhooks. Built with Broadway for concurrent message processing.

## Tech Stack

- **Runtime**: Elixir 1.17 / OTP 26 (amqp library incompatible with OTP 27)
- **Message Consumer**: Broadway + broadway_rabbitmq
- **AMQP Setup**: amqp library
- **HTTP Client**: Req
- **JSON**: Jason
- **Logging**: Elixir Logger + keen_loki_logger (Grafana Loki)
- **Test Mocking**: Mox
- **HTTP Testing**: Bypass + Plug
- **Coverage**: ExCoveralls

## Commands

| Task | Command |
|------|---------|
| Install dependencies | `mix deps.get` |
| Compile | `mix compile` |
| Run tests | `mix test` |
| Run tests with coverage | `mix coveralls` |
| Format code | `mix format` |
| Check formatting | `mix format --check-formatted` |
| Type checking | `mix dialyzer` |
| Start application | `iex -S mix` or `mix run --no-halt` |
| Build release | `mix release` |

## Architecture

Layer-based structure following the global CLAUDE.md conventions, adapted for Elixir:

```
lib/notification_service/
├── consumers/          # Broadway message handlers (one per queue)
├── services/           # Business logic (1:1 with consumers)
├── publishers/         # Shared publishing utilities
├── discord/            # Discord-specific modules (client, router, formatter)
├── rabbitmq/           # RabbitMQ setup and AMQP wrapper
├── config.ex           # Runtime config access
├── errors.ex           # Custom error types
└── application.ex      # OTP supervision tree
```

## Message Flow

```
RabbitMQ (notifications queue)
  → NotificationConsumer (Broadway)
    → NotificationService (orchestrator)
      → Router (routing key → webhook URLs)
      → Formatter (payload → Discord embed)
      → Client (HTTP POST to Discord)
```

## Error Handling

- **RetryableError**: Transient failures (network timeout, Discord 5xx, rate limit) — retried via delayed exchange
- **NonRetryableError**: Permanent failures (invalid JSON, Discord 4xx) — sent directly to DLQ

## DLQ Strategy

Uses RabbitMQ Delayed Message Exchange plugin:
- Max 20 retries with exponential backoff (instant, 1s, 2s, 4s... cap 16h)
- After exhaustion, messages go to `notifications.dlq` queue
- DLQ alerts published to `notifications.dlq.notification-service` routing key

## Testing

All modules use behaviours for testability. Mox mocks are defined in `test/support/mocks.ex`:
- `MockClient` — Discord HTTP client
- `MockRouter` — Routing key mapping
- `MockFormatter` — Embed formatting
- `MockNotificationService` — Service orchestrator
- `MockAMQP` — AMQP operations (injectable wrapper for testability)

Test config (`config/test.exs`) disables Broadway and RabbitMQ setup for unit tests.

**HTTP Testing**: Use Bypass for Discord client tests. Example:
```elixir
bypass = Bypass.open()
Bypass.expect_once(bypass, "POST", "/webhooks/test/token", fn conn ->
  Plug.Conn.send_resp(conn, 200, "")
end)
Client.send_embed("http://localhost:#{bypass.port}/webhooks/test/token", embed)
```

**AMQP Testing**: The `NotificationService.RabbitMQ.AMQPBehaviour` wrapper enables mocking AMQP operations without a real RabbitMQ connection. Configure in tests via:
```elixir
Application.put_env(:notification_service, :amqp_module, NotificationService.RabbitMQ.MockAMQP)
```

## Environment Variables

Required:
- `RABBITMQ_URL` — AMQP connection URI
- `DISCORD_WEBHOOK_DEFAULT` — Fallback webhook URL

Optional webhooks (any `DISCORD_WEBHOOK_<NAME>`):
- `DISCORD_WEBHOOK_INFO`, `DISCORD_WEBHOOK_PRS`, `DISCORD_WEBHOOK_MEDIA`, etc.

Optional routes (any `DISCORD_ROUTE_<CATEGORY>`):
- `DISCORD_ROUTE_CI=info` — routes `ci.*` to the `info` webhook

Optional:
- `DISCORD_ERROR_ROUTES` — Comma-separated prefixes that also send to errors channel
- `LOKI_HOST` — Grafana Loki endpoint for centralized logging
- `LOG_LEVEL` — Logger level (debug, info, warning, error)

## Quality Gates

- **Coverage**: 93% minimum (enforced by ExCoveralls via `coveralls.json`)
- **Formatting**: `mix format --check-formatted` must pass
- **Type checking**: `mix dialyzer` (optional but recommended)

**Coverage Exclusions** (in `coveralls.json`):
- `lib/notification_service/rabbitmq/setup.ex` — requires real RabbitMQ
- `lib/notification_service/rabbitmq/amqp.ex` — thin wrapper, tested via mocks
- `lib/notification_service/application.ex` — OTP supervisor code
- `lib/notification_service.ex` — root module with no logic

## CI/CD

Uses `erlef/setup-beam@v2` for Elixir/OTP setup in GitHub Actions.

Workflows:
- `ci.yml` — Build + deploy on push to main
- `pr.yml` — PR quality checks
- `release.yml` — Release on version tags (v*.*.*)

Docker image: `xmer/notification-service`

## Implementation Notes

1. **Injectable Dependencies**: All external dependencies (Discord client, AMQP) are injected via Application config, enabling Mox-based testing.

2. **Behaviour Pattern**: Each mockable module defines a behaviour (e.g., `ClientBehaviour`, `AMQPBehaviour`) in the same file as the implementation.

3. **Broadway Configuration**: The consumer uses `on_failure: :ack` to prevent message requeue loops — failed messages are handled by `handle_failed/2` which routes them to retry or DLQ.

4. **Concurrent Webhook Delivery**: The service uses `Task.async_stream` to send to multiple webhooks concurrently (e.g., primary + errors channel).
