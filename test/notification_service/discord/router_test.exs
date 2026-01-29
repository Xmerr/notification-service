defmodule NotificationService.Discord.RouterTest do
  use ExUnit.Case, async: true

  alias NotificationService.Discord.Router

  setup do
    base_webhooks = %{
      "default" => "https://discord.com/api/webhooks/default/token",
      "info" => "https://discord.com/api/webhooks/info/token",
      "prs" => "https://discord.com/api/webhooks/prs/token",
      "media" => "https://discord.com/api/webhooks/media/token",
      "alerts" => "https://discord.com/api/webhooks/alerts/token",
      "errors" => "https://discord.com/api/webhooks/errors/token"
    }

    base_routes = %{
      "ci" => "info",
      "pr" => "prs",
      "downloads" => "media",
      "deploy" => "info",
      "polling" => "alerts",
      "dlq" => "alerts"
    }

    base_error_routes = ["ci.failure", "deploy.failure", "dlq", "polling.failure"]

    Application.put_env(:notification_service, :discord_webhooks, base_webhooks)
    Application.put_env(:notification_service, :discord_routes, base_routes)
    Application.put_env(:notification_service, :discord_error_routes, base_error_routes)

    on_exit(fn ->
      Application.delete_env(:notification_service, :discord_webhooks)
      Application.delete_env(:notification_service, :discord_routes)
      Application.delete_env(:notification_service, :discord_error_routes)
    end)

    %{webhooks: base_webhooks, routes: base_routes, error_routes: base_error_routes}
  end

  describe "route/1" do
    test "routes CI messages to the info webhook" do
      urls = Router.route("ci.success")

      assert urls == ["https://discord.com/api/webhooks/info/token"]
    end

    test "routes PR messages to the prs webhook" do
      urls = Router.route("pr.opened")

      assert urls == ["https://discord.com/api/webhooks/prs/token"]
    end

    test "routes download messages to the media webhook" do
      urls = Router.route("downloads.complete")

      assert urls == ["https://discord.com/api/webhooks/media/token"]
    end

    test "routes deploy messages to the info webhook" do
      urls = Router.route("deploy.success")

      assert urls == ["https://discord.com/api/webhooks/info/token"]
    end

    test "routes polling messages to the alerts webhook" do
      urls = Router.route("polling.failure")

      assert "https://discord.com/api/webhooks/alerts/token" in urls
    end

    test "routes DLQ messages to the alerts webhook" do
      urls = Router.route("dlq.qbittorrent")

      assert "https://discord.com/api/webhooks/alerts/token" in urls
    end

    test "falls back to default webhook for unknown routing keys" do
      urls = Router.route("unknown.event")

      assert urls == ["https://discord.com/api/webhooks/default/token"]
    end

    test "falls back to default when routing key has no dots" do
      urls = Router.route("standalone")

      assert urls == ["https://discord.com/api/webhooks/default/token"]
    end

    test "adds errors webhook for ci.failure" do
      urls = Router.route("ci.failure")

      assert "https://discord.com/api/webhooks/info/token" in urls
      assert "https://discord.com/api/webhooks/errors/token" in urls
      assert length(urls) == 2
    end

    test "adds errors webhook for deploy.failure" do
      urls = Router.route("deploy.failure")

      assert "https://discord.com/api/webhooks/info/token" in urls
      assert "https://discord.com/api/webhooks/errors/token" in urls
    end

    test "adds errors webhook for DLQ alerts (prefix match)" do
      urls = Router.route("dlq.qbittorrent")

      assert "https://discord.com/api/webhooks/alerts/token" in urls
      assert "https://discord.com/api/webhooks/errors/token" in urls
    end

    test "adds errors webhook for polling.failure" do
      urls = Router.route("polling.failure")

      assert "https://discord.com/api/webhooks/alerts/token" in urls
      assert "https://discord.com/api/webhooks/errors/token" in urls
    end

    test "does not add errors webhook when errors webhook is not configured" do
      Application.put_env(
        :notification_service,
        :discord_webhooks,
        Map.delete(
          Application.get_env(:notification_service, :discord_webhooks),
          "errors"
        )
      )

      urls = Router.route("ci.failure")

      assert urls == ["https://discord.com/api/webhooks/info/token"]
    end

    test "deduplicates when errors webhook equals primary webhook" do
      Application.put_env(
        :notification_service,
        :discord_webhooks,
        Map.put(
          Application.get_env(:notification_service, :discord_webhooks),
          "errors",
          "https://discord.com/api/webhooks/alerts/token"
        )
      )

      urls = Router.route("dlq.qbittorrent")

      assert urls == ["https://discord.com/api/webhooks/alerts/token"]
    end

    test "falls back to default when webhook name does not exist" do
      Application.put_env(:notification_service, :discord_routes, %{"ci" => "nonexistent"})

      urls = Router.route("ci.success")

      assert urls == ["https://discord.com/api/webhooks/default/token"]
    end

    test "does not duplicate ci.success error route (no error route match)" do
      urls = Router.route("ci.success")

      assert urls == ["https://discord.com/api/webhooks/info/token"]
    end
  end
end
