import Config

config :notification_service,
  rabbitmq_url: "amqp://user:password@192.168.0.100:5672",
  queue_name: "notifications",
  exchange_name: "notifications",
  dlq_exchange_name: "notifications.dlq",
  delay_exchange_name: "notifications.delay",
  max_retries: 20,
  max_backoff_ms: 57_600_000

config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id, :routing_key, :queue]

import_config "#{config_env()}.exs"
