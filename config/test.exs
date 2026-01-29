import Config

config :logger, level: :warning

config :notification_service,
  rabbitmq_url: "amqp://guest:guest@localhost:5672",
  discord_client: NotificationService.Discord.MockClient,
  discord_router: NotificationService.Discord.MockRouter,
  discord_formatter: NotificationService.Discord.MockFormatter,
  notification_service: NotificationService.Services.MockNotificationService,
  amqp_module: NotificationService.RabbitMQ.MockAMQP,
  start_broadway: false,
  start_rabbitmq_setup: false
