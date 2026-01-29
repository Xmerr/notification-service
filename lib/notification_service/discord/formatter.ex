defmodule NotificationService.Discord.FormatterBehaviour do
  @moduledoc """
  Behaviour for Discord message formatting.
  """

  @callback format(routing_key :: String.t(), payload :: map()) :: map()
end

defmodule NotificationService.Discord.Formatter do
  @moduledoc """
  Transforms message payloads into Discord embed maps based on routing key category.
  """

  @behaviour NotificationService.Discord.FormatterBehaviour

  @color_green 0x00FF00
  @color_red 0xFF0000
  @color_yellow 0xFFFF00
  @color_purple 0x800080
  @color_orange 0xFF8C00
  @color_blue 0x0099FF

  @impl true
  @spec format(String.t(), map()) :: map()
  def format("ci.success", payload), do: format_ci(payload, "success", @color_green)
  def format("ci.failure", payload), do: format_ci(payload, "failure", @color_red)

  def format("pr.opened", payload), do: format_pr(payload, "opened", @color_yellow)
  def format("pr.merged", payload), do: format_pr(payload, "merged", @color_purple)
  def format("pr.closed", payload), do: format_pr(payload, "closed", @color_red)

  def format("downloads.complete", payload),
    do: format_download(payload, "Complete", @color_green)

  def format("downloads.removed", payload), do: format_download(payload, "Removed", @color_orange)

  def format("deploy.success", payload), do: format_deploy(payload, "success", @color_green)
  def format("deploy.failure", payload), do: format_deploy(payload, "failure", @color_red)

  def format("polling.failure", payload), do: format_polling_failure(payload)

  def format("dlq." <> _service, payload), do: format_dlq(payload)

  def format(_routing_key, payload), do: format_unknown(payload)

  defp format_ci(payload, conclusion, color) do
    repo = Map.get(payload, "repository", "unknown")
    run_url = Map.get(payload, "run_url")

    %{
      title: "CI: #{repo}",
      color: color,
      url: run_url,
      fields: [
        %{name: "Status", value: Map.get(payload, "status", "unknown"), inline: true},
        %{name: "Result", value: conclusion, inline: true}
      ],
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  defp format_pr(payload, action, color) do
    pr_number = Map.get(payload, "pr_number", "?")
    pr_title = Map.get(payload, "pr_title", "Untitled")
    author = Map.get(payload, "author", "unknown")
    pr_url = Map.get(payload, "pr_url")

    %{
      title: "PR ##{pr_number}: #{pr_title}",
      description: "#{action} by @#{author}",
      color: color,
      url: pr_url,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  defp format_download(payload, action, color) do
    name = Map.get(payload, "name", "Unknown")
    size = Map.get(payload, "size")
    category = Map.get(payload, "category")
    save_path = Map.get(payload, "savePath")

    fields =
      [
        if(size, do: %{name: "Size", value: format_bytes(size), inline: true}),
        if(category, do: %{name: "Category", value: category, inline: true}),
        if(save_path, do: %{name: "Path", value: save_path, inline: false})
      ]
      |> Enum.reject(&is_nil/1)

    %{
      title: "Download #{action}: #{name}",
      color: color,
      fields: fields,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  defp format_deploy(payload, conclusion, color) do
    repo = Map.get(payload, "repository", "unknown")

    fields =
      [
        %{name: "Status", value: conclusion, inline: true},
        if(Map.get(payload, "duration"),
          do: %{name: "Duration", value: Map.get(payload, "duration"), inline: true}
        )
      ]
      |> Enum.reject(&is_nil/1)

    %{
      title: "Deploy: #{repo}",
      color: color,
      fields: fields,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  defp format_polling_failure(payload) do
    service = Map.get(payload, "service", "unknown")
    error = Map.get(payload, "error", "Unknown error")

    %{
      title: "Polling Failure: #{service}",
      color: @color_red,
      fields: [
        %{name: "Error", value: error, inline: false}
      ],
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  defp format_dlq(payload) do
    service = Map.get(payload, "service", "unknown")
    queue = Map.get(payload, "queue", "unknown")
    error = Map.get(payload, "error", "Unknown error")
    retry_count = Map.get(payload, "retryCount", 0)

    %{
      title: "DLQ Alert: #{service}",
      description: "#{queue} queue exceeded retry limit",
      color: @color_red,
      fields: [
        %{name: "Error", value: error, inline: false},
        %{name: "Retries", value: to_string(retry_count), inline: true},
        %{name: "Queue", value: queue, inline: true}
      ],
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  defp format_unknown(payload) do
    description =
      case Jason.encode(payload, pretty: true) do
        {:ok, json} -> "```json\n#{String.slice(json, 0, 1900)}\n```"
        _ -> inspect(payload)
      end

    %{
      title: "Notification",
      description: description,
      color: @color_blue,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    }
  end

  @spec format_bytes(number()) :: String.t()
  defp format_bytes(bytes) when is_number(bytes) do
    cond do
      bytes >= 1_073_741_824 -> "#{Float.round(bytes / 1_073_741_824, 2)} GB"
      bytes >= 1_048_576 -> "#{Float.round(bytes / 1_048_576, 2)} MB"
      bytes >= 1_024 -> "#{Float.round(bytes / 1_024, 2)} KB"
      true -> "#{bytes} B"
    end
  end

  defp format_bytes(_), do: "Unknown"
end
