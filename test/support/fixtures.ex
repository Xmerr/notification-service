defmodule NotificationService.Test.Fixtures do
  @moduledoc """
  Factory functions for test message payloads.
  """

  @spec ci_success_payload(map()) :: map()
  def ci_success_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "repository" => "xmer/test-repo",
        "source" => "github",
        "workflow" => "Build and Deploy",
        "status" => "complete",
        "conclusion" => "success",
        "run_url" => "https://github.com/xmer/test-repo/actions/runs/123"
      },
      overrides
    )
  end

  @spec ci_failure_payload(map()) :: map()
  def ci_failure_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "repository" => "xmer/test-repo",
        "source" => "github",
        "workflow" => "Build and Deploy",
        "status" => "complete",
        "conclusion" => "failure",
        "run_url" => "https://github.com/xmer/test-repo/actions/runs/456"
      },
      overrides
    )
  end

  @spec pr_opened_payload(map()) :: map()
  def pr_opened_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "action" => "opened",
        "repository" => "xmer/test-repo",
        "source" => "github",
        "pr_number" => "42",
        "pr_title" => "Add new feature",
        "pr_url" => "https://github.com/xmer/test-repo/pull/42",
        "author" => "xmer"
      },
      overrides
    )
  end

  @spec pr_merged_payload(map()) :: map()
  def pr_merged_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "action" => "merged",
        "repository" => "xmer/test-repo",
        "source" => "github",
        "pr_number" => "42",
        "pr_title" => "Add new feature",
        "pr_url" => "https://github.com/xmer/test-repo/pull/42",
        "author" => "xmer"
      },
      overrides
    )
  end

  @spec pr_closed_payload(map()) :: map()
  def pr_closed_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "action" => "closed",
        "repository" => "xmer/test-repo",
        "source" => "github",
        "pr_number" => "42",
        "pr_title" => "Add new feature",
        "pr_url" => "https://github.com/xmer/test-repo/pull/42",
        "author" => "xmer"
      },
      overrides
    )
  end

  @spec download_complete_payload(map()) :: map()
  def download_complete_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "hash" => "abc123",
        "name" => "Example.Torrent",
        "savePath" => "/downloads/movies/Example.Torrent",
        "size" => 1_073_741_824,
        "category" => "movies"
      },
      overrides
    )
  end

  @spec download_removed_payload(map()) :: map()
  def download_removed_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "hash" => "abc123",
        "name" => "Example.Torrent",
        "savePath" => "/downloads/movies/Example.Torrent",
        "size" => 1_073_741_824,
        "category" => "movies"
      },
      overrides
    )
  end

  @spec deploy_success_payload(map()) :: map()
  def deploy_success_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "repository" => "xmer/test-repo",
        "status" => "success",
        "duration" => "45s"
      },
      overrides
    )
  end

  @spec deploy_failure_payload(map()) :: map()
  def deploy_failure_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "repository" => "xmer/test-repo",
        "status" => "failure",
        "duration" => "12s"
      },
      overrides
    )
  end

  @spec dlq_alert_payload(map()) :: map()
  def dlq_alert_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "service" => "qbittorrent-consumer",
        "queue" => "downloads.add",
        "error" => "qBittorrent API timeout",
        "retryCount" => 20,
        "originalMessage" => %{"magnetLink" => "magnet:?xt=..."},
        "timestamp" => "2026-01-26T12:00:00Z"
      },
      overrides
    )
  end

  @spec polling_failure_payload(map()) :: map()
  def polling_failure_payload(overrides \\ %{}) do
    Map.merge(
      %{
        "service" => "qbittorrent-consumer",
        "error" => "qBittorrent API unreachable for 10+ minutes"
      },
      overrides
    )
  end
end
