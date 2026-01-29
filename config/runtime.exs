import Config

if config_env() != :test do
  config :notification_service,
    rabbitmq_url:
      System.get_env("RABBITMQ_URL") ||
        raise("RABBITMQ_URL environment variable is required"),
    discord_client: NotificationService.Discord.Client

  # Parse DISCORD_WEBHOOK_* env vars into a map of name → URL
  webhooks =
    System.get_env()
    |> Enum.filter(fn {key, _} -> String.starts_with?(key, "DISCORD_WEBHOOK_") end)
    |> Enum.map(fn {key, value} ->
      name =
        key
        |> String.replace_prefix("DISCORD_WEBHOOK_", "")
        |> String.downcase()

      {name, value}
    end)
    |> Map.new()

  unless Map.has_key?(webhooks, "default") do
    raise "DISCORD_WEBHOOK_DEFAULT environment variable is required"
  end

  config :notification_service, discord_webhooks: webhooks

  # Parse DISCORD_ROUTE_* env vars into a map of category → webhook name
  routes =
    System.get_env()
    |> Enum.filter(fn {key, _} -> String.starts_with?(key, "DISCORD_ROUTE_") end)
    |> Enum.map(fn {key, value} ->
      category =
        key
        |> String.replace_prefix("DISCORD_ROUTE_", "")
        |> String.downcase()

      {category, String.downcase(value)}
    end)
    |> Map.new()

  config :notification_service, discord_routes: routes

  # Parse DISCORD_ERROR_ROUTES (comma-separated prefixes)
  error_routes =
    case System.get_env("DISCORD_ERROR_ROUTES") do
      nil -> ["ci.failure", "deploy.failure", "dlq", "polling.failure"]
      value -> value |> String.split(",") |> Enum.map(&String.trim/1)
    end

  config :notification_service, discord_error_routes: error_routes

  # Optional: Loki host
  if loki_host = System.get_env("LOKI_HOST") do
    config :notification_service, loki_host: loki_host

    config :keen_loki_logger,
      endpoint: "#{loki_host}/loki/api/v1/push",
      labels: %{job: "notification-service", environment: to_string(config_env())},
      level: :info

    config :logger,
      backends: [:console, KeenLokiLogger]
  end

  # Optional: Log level override
  if log_level = System.get_env("LOG_LEVEL") do
    config :logger, level: String.to_existing_atom(log_level)
  end
end
