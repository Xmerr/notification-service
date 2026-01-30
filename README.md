# Notification Service

RabbitMQ consumer that routes messages from the `notifications` exchange to Discord channels via the `discord` exchange. Built with Bun and TypeScript.

## Links

- [GitHub](https://github.com/Xmerr/notification-service)
- [Docker Hub](https://hub.docker.com/r/xmer/notification-service)

## Features

- **Flexible Routing**: Map routing key prefixes to different Discord channels
- **Error Routing**: Automatically send critical events (failures, DLQ alerts) to a dedicated errors channel
- **Retry with Backoff**: Exponential backoff via RabbitMQ Delayed Message Exchange plugin
- **Dead Letter Queue**: Failed messages routed to DLQ with alerting

## Prerequisites

- Bun 1.x
- RabbitMQ 3.12+ with [Delayed Message Exchange plugin](https://github.com/rabbitmq/rabbitmq-delayed-message-exchange)
- Discord Bot Service (consuming from `discord` exchange)
- Docker (for containerized deployment)

## Quick Start

### Local Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Start the application
bun run start
```

### Docker

```bash
# Build the image
docker build -t xmer/notification-service .

# Run with environment variables
docker run -d \
  --name notification-service \
  -e RABBITMQ_URL="amqp://user:pass@rabbitmq:5672" \
  -e DISCORD_CHANNEL_DEFAULT="123456789012345678" \
  xmer/notification-service
```

### Docker Compose

```yaml
services:
  notification-service:
    image: xmer/notification-service:latest
    environment:
      - RABBITMQ_URL=amqp://user:pass@rabbitmq:5672
      - DISCORD_CHANNEL_DEFAULT=123456789012345678
      - DISCORD_CHANNEL_INFO=234567890123456789
      - DISCORD_CHANNEL_ERRORS=345678901234567890
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
| `DISCORD_CHANNEL_DEFAULT` | Fallback channel ID for unrouted messages | `123456789012345678` |

### Optional Channels

Define named channels using the `DISCORD_CHANNEL_<NAME>` pattern:

| Variable | Description |
|----------|-------------|
| `DISCORD_CHANNEL_INFO` | Channel for informational messages (CI, deploys) |
| `DISCORD_CHANNEL_PRS` | Channel for pull request notifications |
| `DISCORD_CHANNEL_MEDIA` | Channel for download/media notifications |
| `DISCORD_CHANNEL_ALERTS` | Channel for alerts and warnings |
| `DISCORD_CHANNEL_ERRORS` | Channel for critical errors (receives duplicates of error routes) |

### Optional Routes

Map routing key prefixes to channel names using `DISCORD_ROUTE_<CATEGORY>`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_ROUTE_CI` | (none) | Route `ci.*` messages to specified channel |
| `DISCORD_ROUTE_PR` | (none) | Route `pr.*` messages to specified channel |
| `DISCORD_ROUTE_DOWNLOADS` | (none) | Route `downloads.*` messages to specified channel |
| `DISCORD_ROUTE_DEPLOY` | (none) | Route `deploy.*` messages to specified channel |
| `DISCORD_ROUTE_POLLING` | (none) | Route `polling.*` messages to specified channel |
| `DISCORD_ROUTE_DLQ` | (none) | Route `dlq.*` messages to specified channel |

### Error Routes

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCORD_ERROR_ROUTES` | `ci.failure,deploy.failure,dlq,polling.failure` | Comma-separated routing key prefixes that also send to the errors channel |

### Infrastructure

| Variable | Default | Description |
|----------|---------|-------------|
| `LOKI_HOST` | (none) | Grafana Loki endpoint for centralized logging |
| `LOG_LEVEL` | `info` | Logger level: `debug`, `info`, `warn`, `error` |

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
  → NotificationConsumer
    → NotificationService (orchestrator)
      → ChannelRouter (routing key → channel IDs)
      → Formatter (payload → Discord embed)
      → DiscordPublisher (publish to discord exchange)
        → discord-bot service
          → Discord API
```

### Message Contract

Published to `discord` exchange with routing key `post.send`:

```json
{
  "id": "notification-<uuid>",
  "channel_id": "123456789012345678",
  "embed": {
    "title": "CI Build Succeeded",
    "color": 5747335,
    "fields": [...]
  }
}
```

### DLQ Strategy

- **Max Retries**: 20 attempts with exponential backoff
- **Backoff Schedule**: instant, 1s, 2s, 4s, 8s... up to 16 hours
- **DLQ Alert**: Published to `notifications.dlq.notification-service` routing key

## Development

```bash
# Run tests
bun test

# Run tests with coverage
bun run test:coverage

# Lint code
bun run lint

# Format code
bun run format

# Type checking
bun run typecheck
```

## License

MIT
