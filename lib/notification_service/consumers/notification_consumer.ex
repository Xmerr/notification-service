defmodule NotificationService.Consumers.NotificationConsumer do
  @moduledoc """
  Broadway pipeline for consuming messages from the notifications queue.

  Receives RabbitMQ messages, decodes JSON payloads, extracts routing keys,
  and delegates to the notification service for processing. Failed messages
  are routed through the DLQ publisher for retry or dead-lettering.
  """

  use Broadway

  require Logger

  alias Broadway.Message
  alias NotificationService.{Config, NonRetryableError}
  alias NotificationService.Publishers.DlqPublisher
  alias NotificationService.Services.NotificationService, as: NotifService

  @spec start_link(keyword()) :: {:ok, pid()} | {:error, term()}
  def start_link(opts \\ []) do
    Broadway.start_link(__MODULE__,
      name: __MODULE__,
      producer: [
        module:
          {BroadwayRabbitMQ.Producer,
           queue: Config.queue_name(),
           connection: Config.rabbitmq_url(),
           qos: [prefetch_count: Keyword.get(opts, :prefetch_count, 10)],
           on_failure: :ack},
        concurrency: 1
      ],
      processors: [
        default: [
          concurrency: Keyword.get(opts, :concurrency, 10)
        ]
      ]
    )
  end

  @impl true
  @spec handle_message(atom(), Message.t(), term()) :: Message.t()
  def handle_message(_processor, %Message{} = message, _context) do
    routing_key = extract_routing_key(message)
    Logger.metadata(routing_key: routing_key)

    case decode_and_process(message.data, routing_key) do
      :ok ->
        message

      {:error, %NonRetryableError{} = error} ->
        Message.failed(message, {:non_retryable, error})

      {:error, error} ->
        Message.failed(message, {:retryable, error})
    end
  end

  @impl true
  @spec handle_failed([Message.t()], term()) :: [Message.t()]
  def handle_failed(messages, _context) do
    Enum.map(messages, fn %Message{} = message ->
      case message.status do
        {:failed, {:non_retryable, error}} ->
          handle_non_retryable_failure(message, error)

        {:failed, {:retryable, error}} ->
          handle_retryable_failure(message, error)

        {:failed, reason} ->
          error = RuntimeError.exception("Unexpected failure: #{inspect(reason)}")
          handle_retryable_failure(message, error)
      end

      message
    end)
  end

  defp decode_and_process(data, routing_key) do
    case Jason.decode(data) do
      {:ok, payload} ->
        NotifService.process_message(routing_key, payload)

      {:error, decode_error} ->
        {:error,
         NonRetryableError.exception(
           message: "Failed to decode JSON: #{inspect(decode_error)}",
           code: "INVALID_JSON",
           context: %{data: String.slice(to_string(data), 0, 200)}
         )}
    end
  end

  defp extract_routing_key(%Message{metadata: %{routing_key: routing_key}}), do: routing_key
  defp extract_routing_key(_), do: "unknown"

  defp handle_retryable_failure(message, error) do
    routing_key = extract_routing_key(message)

    Logger.warning("Retryable failure, scheduling retry",
      routing_key: routing_key,
      error: Exception.message(error)
    )

    msg_map = build_message_map(message)

    with_dlq_channel(fn channel ->
      DlqPublisher.retry_message(channel, msg_map, error)
    end)
  end

  defp handle_non_retryable_failure(message, error) do
    routing_key = extract_routing_key(message)

    Logger.error("Non-retryable failure, sending to DLQ",
      routing_key: routing_key,
      error: Exception.message(error)
    )

    msg_map = build_message_map(message)

    with_dlq_channel(fn channel ->
      DlqPublisher.send_to_dlq(channel, msg_map, error)
    end)
  end

  defp build_message_map(%Message{} = message) do
    headers =
      case message.metadata do
        %{headers: headers} when is_list(headers) -> headers
        _ -> []
      end

    %{
      routing_key: extract_routing_key(message),
      payload: to_string(message.data),
      headers: headers
    }
  end

  defp with_dlq_channel(fun) do
    amqp = amqp()

    case amqp.open_connection(Config.rabbitmq_url()) do
      {:ok, conn} ->
        case amqp.open_channel(conn) do
          {:ok, channel} ->
            try do
              fun.(channel)
            after
              amqp.close_channel(channel)
              amqp.close_connection(conn)
            end

          {:error, reason} ->
            Logger.error("Failed to open DLQ channel: #{inspect(reason)}")
        end

      {:error, reason} ->
        Logger.error("Failed to open DLQ connection: #{inspect(reason)}")
    end
  end

  defp amqp do
    Application.get_env(
      :notification_service,
      :amqp_module,
      NotificationService.RabbitMQ.AMQP
    )
  end
end
