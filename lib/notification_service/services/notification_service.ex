defmodule NotificationService.Services.NotificationServiceBehaviour do
  @moduledoc """
  Behaviour for notification service orchestration.
  """

  @callback process_message(routing_key :: String.t(), payload :: map()) ::
              :ok | {:error, Exception.t()}
end

defmodule NotificationService.Services.NotificationService do
  @moduledoc """
  Orchestrates the notification pipeline: route -> format -> send.

  For each message, determines the target Discord webhooks, formats the payload
  into a Discord embed, and sends to all matching webhooks concurrently.
  """

  @behaviour NotificationService.Services.NotificationServiceBehaviour

  require Logger

  alias NotificationService.Discord.{Router, Formatter}
  alias NotificationService.Config

  @impl true
  @spec process_message(String.t(), map()) :: :ok | {:error, Exception.t()}
  def process_message(routing_key, payload) do
    Logger.info("Processing notification", routing_key: routing_key)

    webhook_urls = Router.route(routing_key)
    embed = Formatter.format(routing_key, payload)
    client = Config.discord_client()

    results =
      webhook_urls
      |> Task.async_stream(
        fn url -> client.send_embed(url, embed) end,
        timeout: 30_000,
        ordered: false
      )
      |> Enum.map(fn
        {:ok, :ok} -> :ok
        {:ok, {:error, error}} -> {:error, error}
        {:exit, reason} -> {:error, RuntimeError.exception("Task exited: #{inspect(reason)}")}
      end)

    case Enum.find(results, &match?({:error, _}, &1)) do
      nil ->
        Logger.info("Notification sent successfully",
          routing_key: routing_key,
          webhook_count: length(webhook_urls)
        )

        :ok

      {:error, error} ->
        Logger.error("Notification delivery failed",
          routing_key: routing_key,
          error: Exception.message(error)
        )

        {:error, error}
    end
  end
end
