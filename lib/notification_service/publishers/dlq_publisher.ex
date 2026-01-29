defmodule NotificationService.Publishers.DlqPublisher do
  @moduledoc """
  Handles message retry logic and dead-letter queue routing.

  Uses the RabbitMQ Delayed Message Exchange plugin for exponential backoff retries.
  After retry exhaustion, messages are routed to the DLQ and an alert is published.
  """

  require Logger

  alias NotificationService.Config

  @max_retries 20
  @max_backoff_ms 57_600_000

  @spec retry_message(AMQP.Channel.t(), map(), Exception.t()) :: :ok
  def retry_message(channel, message, error) do
    retry_count = get_retry_count(message)

    if retry_count < max_retries() do
      delay = calculate_backoff(retry_count)
      publish_to_delay(channel, message, error, retry_count, delay)
    else
      send_to_dlq(channel, message, error)
    end
  end

  @spec send_to_dlq(AMQP.Channel.t(), map(), Exception.t()) :: :ok
  def send_to_dlq(channel, message, error) do
    retry_count = get_retry_count(message)
    routing_key = Map.get(message, :routing_key, "unknown")
    payload = Map.get(message, :payload, "")

    headers = [
      {"x-retry-count", :long, retry_count},
      {"x-first-failure-timestamp", :longstr, get_first_failure(message)},
      {"x-last-error", :longstr, Exception.message(error)}
    ]

    Logger.error("Message sent to DLQ after #{retry_count} retries",
      routing_key: routing_key,
      error: Exception.message(error),
      retry_count: retry_count
    )

    amqp().publish(
      channel,
      Config.dlq_exchange_name(),
      routing_key,
      payload,
      headers: headers,
      persistent: true
    )

    publish_dlq_alert(channel, routing_key, error, retry_count, payload)
  end

  @spec calculate_backoff(non_neg_integer()) :: non_neg_integer()
  def calculate_backoff(0), do: 0

  def calculate_backoff(retry_count) do
    delay = :math.pow(2, retry_count - 1) * 1_000
    min(round(delay), max_backoff_ms())
  end

  defp publish_to_delay(channel, message, error, retry_count, delay) do
    routing_key = Map.get(message, :routing_key, "unknown")
    payload = Map.get(message, :payload, "")

    headers = [
      {"x-retry-count", :long, retry_count + 1},
      {"x-first-failure-timestamp", :longstr, get_first_failure(message)},
      {"x-last-error", :longstr, Exception.message(error)},
      {"x-delay", :long, delay}
    ]

    Logger.warning("Retrying message via delayed exchange",
      routing_key: routing_key,
      retry_count: retry_count + 1,
      delay_ms: delay
    )

    amqp().publish(
      channel,
      Config.delay_exchange_name(),
      routing_key,
      payload,
      headers: headers,
      persistent: true
    )
  end

  defp publish_dlq_alert(channel, routing_key, error, retry_count, original_payload) do
    alert =
      Jason.encode!(%{
        service: "notification-service",
        queue: Config.queue_name(),
        error: Exception.message(error),
        retryCount: retry_count,
        originalMessage: truncate_payload(original_payload),
        timestamp: DateTime.utc_now() |> DateTime.to_iso8601(),
        routingKey: routing_key
      })

    amqp().publish(
      channel,
      Config.exchange_name(),
      "notifications.dlq.notification-service",
      alert,
      persistent: true,
      content_type: "application/json"
    )
  end

  defp get_retry_count(%{headers: headers}) when is_list(headers) do
    case List.keyfind(headers, "x-retry-count", 0) do
      {_, _, count} when is_integer(count) -> count
      _ -> 0
    end
  end

  defp get_retry_count(_), do: 0

  defp get_first_failure(%{headers: headers}) when is_list(headers) do
    case List.keyfind(headers, "x-first-failure-timestamp", 0) do
      {_, _, timestamp} when is_binary(timestamp) -> timestamp
      _ -> DateTime.utc_now() |> DateTime.to_iso8601()
    end
  end

  defp get_first_failure(_), do: DateTime.utc_now() |> DateTime.to_iso8601()

  defp truncate_payload(payload) when byte_size(payload) > 500 do
    String.slice(payload, 0, 500) <> "..."
  end

  defp truncate_payload(payload), do: payload

  defp amqp do
    Application.get_env(
      :notification_service,
      :amqp_module,
      NotificationService.RabbitMQ.AMQP
    )
  end

  defp max_retries, do: Config.max_retries() || @max_retries
  defp max_backoff_ms, do: Config.max_backoff_ms() || @max_backoff_ms
end
