import Config

config :logger, level: :debug

config :notification_service,
  discord_client: NotificationService.Discord.Client
