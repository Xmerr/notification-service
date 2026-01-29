defmodule NotificationService.Discord.ClientBehaviour do
  @moduledoc """
  Behaviour for Discord webhook HTTP client.
  """

  @callback send_embed(webhook_url :: String.t(), embed :: map()) ::
              :ok | {:error, Exception.t()}
end

defmodule NotificationService.Discord.Client do
  @moduledoc """
  Discord webhook HTTP client using Req.

  Handles rate limiting (429), retries on transient errors,
  and classifies responses into retryable vs non-retryable errors.
  """

  @behaviour NotificationService.Discord.ClientBehaviour

  require Logger

  alias NotificationService.{RetryableError, NonRetryableError}

  @max_attempts 3
  @base_delay_ms 1_000

  @impl true
  @spec send_embed(String.t(), map()) :: :ok | {:error, Exception.t()}
  def send_embed(webhook_url, embed) do
    body = Jason.encode!(%{embeds: [embed]})
    do_send(webhook_url, body, 1)
  end

  defp do_send(webhook_url, body, attempt) when attempt <= @max_attempts do
    Logger.debug("Sending Discord webhook",
      url: redact_url(webhook_url),
      attempt: attempt
    )

    case Req.post(webhook_url,
           body: body,
           headers: [{"content-type", "application/json"}],
           receive_timeout: 10_000
         ) do
      {:ok, %Req.Response{status: status}} when status in 200..299 ->
        Logger.debug("Discord webhook sent successfully",
          url: redact_url(webhook_url),
          status: status
        )

        :ok

      {:ok, %Req.Response{status: 204}} ->
        :ok

      {:ok, %Req.Response{status: 429} = response} ->
        handle_rate_limit(webhook_url, body, attempt, response)

      {:ok, %Req.Response{status: status}} when status >= 500 ->
        handle_server_error(webhook_url, body, attempt, status)

      {:ok, %Req.Response{status: status, body: resp_body}} ->
        {:error,
         NonRetryableError.exception(
           message: "Discord API returned #{status}",
           code: "DISCORD_CLIENT_ERROR",
           context: %{status: status, body: resp_body, url: redact_url(webhook_url)}
         )}

      {:error, %Req.TransportError{reason: reason}} ->
        handle_transport_error(webhook_url, body, attempt, reason)

      {:error, reason} ->
        handle_transport_error(webhook_url, body, attempt, reason)
    end
  end

  defp do_send(webhook_url, _body, _attempt) do
    {:error,
     RetryableError.exception(
       message: "Discord webhook failed after #{@max_attempts} attempts",
       code: "DISCORD_MAX_RETRIES",
       context: %{url: redact_url(webhook_url)}
     )}
  end

  defp handle_rate_limit(webhook_url, body, attempt, response) do
    retry_after =
      case Req.Response.get_header(response, "retry-after") do
        [value | _] -> parse_retry_after(value)
        _ -> backoff_delay(attempt)
      end

    Logger.warning("Discord rate limited, retrying",
      url: redact_url(webhook_url),
      retry_after_ms: retry_after,
      attempt: attempt
    )

    Process.sleep(retry_after)
    do_send(webhook_url, body, attempt + 1)
  end

  defp handle_server_error(webhook_url, body, attempt, status) do
    if attempt < @max_attempts do
      delay = backoff_delay(attempt)

      Logger.warning("Discord server error, retrying",
        url: redact_url(webhook_url),
        status: status,
        delay_ms: delay,
        attempt: attempt
      )

      Process.sleep(delay)
      do_send(webhook_url, body, attempt + 1)
    else
      {:error,
       RetryableError.exception(
         message: "Discord server error #{status} after #{@max_attempts} attempts",
         code: "DISCORD_SERVER_ERROR",
         context: %{status: status, url: redact_url(webhook_url)}
       )}
    end
  end

  defp handle_transport_error(webhook_url, body, attempt, reason) do
    if attempt < @max_attempts do
      delay = backoff_delay(attempt)

      Logger.warning("Discord transport error, retrying",
        url: redact_url(webhook_url),
        reason: inspect(reason),
        delay_ms: delay,
        attempt: attempt
      )

      Process.sleep(delay)
      do_send(webhook_url, body, attempt + 1)
    else
      {:error,
       RetryableError.exception(
         message: "Discord connection failed: #{inspect(reason)}",
         code: "DISCORD_TRANSPORT_ERROR",
         context: %{reason: inspect(reason), url: redact_url(webhook_url)}
       )}
    end
  end

  defp backoff_delay(attempt) do
    @base_delay_ms * Integer.pow(2, attempt - 1)
  end

  defp parse_retry_after(value) do
    case Float.parse(value) do
      {seconds, _} -> round(seconds * 1_000)
      :error -> @base_delay_ms
    end
  end

  defp redact_url(url) do
    case String.split(url, "/webhooks/") do
      [base, _rest] -> "#{base}/webhooks/***"
      _ -> "***"
    end
  end
end
