# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Overview

Bun-based RabbitMQ consumer that routes messages from the `notifications` exchange to Discord channels via webhooks.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript (strict mode)
- **Message Broker**: RabbitMQ (amqplib)
- **HTTP Client**: Native fetch
- **Logging**: Pino + pino-loki (Grafana Loki)
- **Linting/Formatting**: Biome
- **Testing**: Bun test runner

## Commands

| Task | Command |
|------|---------|
| Install dependencies | `bun install` |
| Start application | `bun run start` |
| Start with watch | `bun run dev` |
| Build | `bun run build` |
| Run tests | `bun test` |
| Run tests with coverage | `bun run test:coverage` |
| Lint | `bun run lint` |
| Lint and fix | `bun run lint:fix` |
| Format | `bun run format` |
| Type check | `bun run typecheck` |

## Architecture

Layer-based structure following the global CLAUDE.md conventions:

```
src/
├── index.ts              # Entry point — bootstrap and start consumers
├── config/
│   ├── index.ts          # Environment variables and configuration
│   └── rabbitmq.ts       # RabbitMQ connection and channel setup
├── consumers/
│   └── notifications.consumer.ts  # Queue subscription handler
├── services/
│   └── notifications.service.ts   # Business logic — orchestrator
├── publishers/
│   └── notifications.publisher.ts # Retry and DLQ publishing
├── discord/
│   ├── client.ts         # HTTP client for Discord webhooks
│   ├── router.ts         # Routing key → webhook URL mapping
│   └── formatter.ts      # Payload → Discord embed formatting
├── errors/
│   └── index.ts          # Custom error classes
└── types/
    └── index.ts          # TypeScript interfaces
```

## Message Flow

```
RabbitMQ (notifications queue)
  → notifications.consumer.ts (validate, ack/nack, delegate)
    → notifications.service.ts (orchestrator)
      → router.ts (routing key → webhook URLs)
      → formatter.ts (payload → Discord embed)
      → client.ts (HTTP POST to Discord)
```

## Error Handling

- **RetryableError**: Transient failures (network timeout, Discord 5xx, rate limit) — retried via delayed exchange
- **NonRetryableError**: Permanent failures (invalid JSON, Discord 4xx) — sent directly to DLQ

## DLQ Strategy

Uses RabbitMQ Delayed Message Exchange plugin:
- Max 20 retries with exponential backoff (instant, 1s, 2s, 4s... cap 16h)
- After exhaustion, messages go to `notifications.dlq` queue
- DLQ alerts published to `notifications.dlq.notification-service` routing key

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

- **Coverage**: 95% minimum
- **Linting**: `bun run lint` must pass
- **Type checking**: `bun run typecheck` must pass

## CI/CD

Uses `oven-sh/setup-bun@v2` for Bun setup in GitHub Actions.

Workflows:
- `ci.yml` — Build + deploy on push to main
- `pr.yml` — PR quality checks
- `release.yml` — Release on version tags (v*.*.*)

Docker image: `xmer/notification-service`
