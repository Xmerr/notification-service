# Notification Service

Elixir-based RabbitMQ consumer that routes messages from the `notifications` exchange to Discord channels via webhooks. Built with Broadway for concurrent message processing.

## Features

- **Concurrent Processing**: Broadway-based pipeline with configurable concurrency
- **Flexible Routing**: Map routing key prefixes to different Discord webhooks
- **Error Routing**: Automatically send critical events (failures, DLQ alerts) to a dedicated errors channel
- **Retry with Backoff**: Exponential backoff via RabbitMQ Delayed Message Exchange plugin
- **Dead Letter Queue**: Failed messages routed to DLQ with alerting

## Prerequisites

- Elixir 1.17+ / OTP 26+
- RabbitMQ 3.12+ with [Delayed Message Exchange plugin](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange)
- Docker (for containerized deployment)

## Quick Start

### Local Development

```bash
# Install dependencies
mix deps.get

# Run tests
mix test

# Start the application
iex -S mix
```

### Docker

```bash
# Build the image
docker build -t xmer/notification-service .

# Run with environment variables
docker run -d \
  --name notification-service \
  -e RABBITMQ_URL="amqp://user:pass@rabbitmq:5672" \
  -e DISCORD_WEBHOOK_DEFAULT="https://discord.com/api/webhooks/..." \
  xmer/notification-service
```

### Docker Compose

```yaml
services:
  notification-service:
    image: xmer/notification-service:latest
    environment:
      - RABBITMQ_URL=amqp://user:pass@rabbitmq:5672
      - DISCORD_WEBHOOK_DEFAULT=https://discord.com/api/webhooks/.../...
      - DISCORD_WEBHOOK_INFO=https://discord.com/api/webhooks/.../...
      - DISCORD_WEBHOOK_ERRORS=https://discord.com/api/webhooks/.../...
      - DISCORD_ROUTE_CI=info
      - DISCORD_ROUTE_PR=info
      - DISCORD_ERROR_ROUTES=ci.failure,deploy.failure,dlq,polling.failure
    restart: unless-stopped
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `RABBITMQ_URL` | AMQP connection URI | `amqp://user:pass@192.168.0.100:5672` |
| `DISCORD_WEBHOOK_DEFAULT` | Fallback webhook for unrouted messages | `https://discord.com/api/webhooks/.../...` |

### Optional Webhooks

Define named webhooks using the `DISCORD_WEBHOOK_<NAME>` pattern:

| Variable | Description |
|----------|-------------|
| `DISCORD_WEBHOOK_INFO` | Webhook for informational messages (CI, deploys) |
| `DISCORD_WEBHOOK_PRS` | Webhook for pull request notifications |
| `DISCORD_WEBHOOK_MEDIA` | Webhook for download/media notifications |
| `DISCORD_WEBHOOK_ALERTS` | Webhook for alerts and warnings |
| `DISCORD_WEBHOOK_ERRORS` | Webhook for critical errors (receives duplicates of error routes) |

### Optional Routes

Map routing key prefixes to webhook names using `DISCORD_ROUTE_<CATEGORY>`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_ROUTE_CI` | (none) | Route `ci.*` messages to specified webhook |
| `DISCORD_ROUTE_PR` | (none) | Route `pr.*` messages to specified webhook |
| `DISCORD_ROUTE_DOWNLOADS` | (none) | Route `downloads.*` messages to specified webhook |
| `DISCORD_ROUTE_DEPLOY` | (none) | Route `deploy.*` messages to specified webhook |
| `DISCORD_ROUTE_POLLING` | (none) | Route `polling.*` messages to specified webhook |
| `DISCORD_ROUTE_DLQ` | (none) | Route `dlq.*` messages to specified webhook |

### Error Routes

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_ERROR_ROUTES` | `ci.failure,deploy.failure,dlq,polling.failure` | Comma-separated routing key prefixes that also send to the errors webhook |

### Infrastructure

| Variable | Default | Description |
|----------|---------|-------------|
| `LOKI_HOST` | (none) | Grafana Loki endpoint for centralized logging |
| `LOG_LEVEL` | `info` | Logger level: `debug`, `info`, `warning`, `error` |

## Message Types

The service formats different message types into Discord embeds:

| Routing Key | Description | Color |
|-------------|-------------|-------|
| `ci.success` | CI build succeeded | Green |
| `ci.failure` | CI build failed | Red |
| `pr.opened` | Pull request opened | Yellow |
| `pr.merged` | Pull request merged | Purple |
| `pr.closed` | Pull request closed | Red |
| `downloads.complete` | Download finished | Green |
| `downloads.removed` | Download removed | Orange |
| `deploy.success` | Deployment succeeded | Green |
| `deploy.failure` | Deployment failed | Red |
| `polling.failure` | Service polling failed | Red |
| `dlq.*` | Dead letter queue alert | Red |

## Architecture

```
RabbitMQ (notifications queue)
  → NotificationConsumer (Broadway)
    → NotificationService (orchestrator)
      → Router (routing key → webhook URLs)
      → Formatter (payload → Discord embed)
      → Client (HTTP POST to Discord)
```

### DLQ Strategy

- **Max Retries**: 20 attempts with exponential backoff
- **Backoff Schedule**: instant, 1s, 2s, 4s, 8s... up to 16 hours
- **DLQ Alert**: Published to `notifications.dlq.notification-service` routing key

## Development

```bash
# Run tests
mix test

# Run tests with coverage
mix coveralls

# Format code
mix format

# Check formatting
mix format --check-formatted

# Type checking (optional)
mix dialyzer
```

## License

MIT
