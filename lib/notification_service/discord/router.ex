defmodule NotificationService.Discord.RouterBehaviour do
  @moduledoc """
  Behaviour for Discord webhook routing.
  """

  @callback route(routing_key :: String.t()) :: [String.t()]
end

defmodule NotificationService.Discord.Router do
  @moduledoc """
  Maps routing keys to Discord webhook URLs.

  Uses configuration to determine which webhook(s) to send each message to:
  - Primary webhook based on routing key category → webhook name mapping
  - Optional errors webhook for critical routing key prefixes
  """

  @behaviour NotificationService.Discord.RouterBehaviour

  alias NotificationService.Config

  @impl true
  @spec route(String.t()) :: [String.t()]
  def route(routing_key) do
    webhooks = Config.discord_webhooks()
    routes = Config.discord_routes()
    error_routes = Config.discord_error_routes()

    primary_url = resolve_primary_url(routing_key, webhooks, routes)
    error_url = resolve_error_url(routing_key, webhooks, error_routes)

    [primary_url, error_url]
    |> Enum.reject(&is_nil/1)
    |> Enum.uniq()
  end

  defp resolve_primary_url(routing_key, webhooks, routes) do
    category = extract_category(routing_key)

    case Map.get(routes, category) do
      nil ->
        Map.get(webhooks, "default")

      webhook_name ->
        Map.get(webhooks, webhook_name) || Map.get(webhooks, "default")
    end
  end

  defp resolve_error_url(routing_key, webhooks, error_routes) do
    errors_webhook = Map.get(webhooks, "errors")

    if errors_webhook && matches_error_route?(routing_key, error_routes) do
      errors_webhook
    else
      nil
    end
  end

  defp matches_error_route?(routing_key, error_routes) do
    Enum.any?(error_routes, fn prefix ->
      String.starts_with?(routing_key, prefix)
    end)
  end

  @spec extract_category(String.t()) :: String.t()
  defp extract_category(routing_key) do
    routing_key
    |> String.split(".")
    |> List.first("")
  end
end
