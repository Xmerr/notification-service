defmodule NotificationService.Services.NotificationServiceTest do
  use ExUnit.Case, async: false

  import Mox

  alias NotificationService.Services.NotificationService, as: NotifService
  alias NotificationService.Test.Fixtures

  setup :verify_on_exit!

  setup do
    Application.put_env(
      :notification_service,
      :discord_client,
      NotificationService.Discord.MockClient
    )

    Application.put_env(
      :notification_service,
      :discord_webhooks,
      %{
        "default" => "https://discord.com/api/webhooks/default/token",
        "info" => "https://discord.com/api/webhooks/info/token"
      }
    )

    Application.put_env(:notification_service, :discord_routes, %{"ci" => "info"})
    Application.put_env(:notification_service, :discord_error_routes, ["ci.failure"])

    on_exit(fn ->
      Application.put_env(
        :notification_service,
        :discord_client,
        NotificationService.Discord.MockClient
      )
    end)

    :ok
  end

  describe "process_message/2" do
    test "sends embed to all routed webhooks successfully" do
      # Arrange
      payload = Fixtures.ci_success_payload()

      NotificationService.Discord.MockClient
      |> expect(:send_embed, fn _url, _embed -> :ok end)

      # Act
      result = NotifService.process_message("ci.success", payload)

      # Assert
      assert result == :ok
    end

    test "returns error when discord client fails" do
      # Arrange
      payload = Fixtures.ci_failure_payload()
      error = NotificationService.RetryableError.exception(message: "Discord timeout")

      NotificationService.Discord.MockClient
      |> expect(:send_embed, fn _url, _embed -> {:error, error} end)

      # Act
      result = NotifService.process_message("ci.failure", payload)

      # Assert
      assert {:error, %NotificationService.RetryableError{}} = result
    end

    test "sends to multiple webhooks when error route matches" do
      # Arrange
      Application.put_env(
        :notification_service,
        :discord_webhooks,
        %{
          "default" => "https://discord.com/api/webhooks/default/token",
          "info" => "https://discord.com/api/webhooks/info/token",
          "errors" => "https://discord.com/api/webhooks/errors/token"
        }
      )

      payload = Fixtures.ci_failure_payload()

      NotificationService.Discord.MockClient
      |> expect(:send_embed, 2, fn _url, _embed -> :ok end)

      # Act
      result = NotifService.process_message("ci.failure", payload)

      # Assert
      assert result == :ok
    end

    test "returns first error when one of multiple webhooks fails" do
      # Arrange
      Application.put_env(
        :notification_service,
        :discord_webhooks,
        %{
          "default" => "https://discord.com/api/webhooks/default/token",
          "info" => "https://discord.com/api/webhooks/info/token",
          "errors" => "https://discord.com/api/webhooks/errors/token"
        }
      )

      payload = Fixtures.ci_failure_payload()
      error = NotificationService.RetryableError.exception(message: "Network timeout")

      NotificationService.Discord.MockClient
      |> expect(:send_embed, 2, fn _url, _embed -> {:error, error} end)

      # Act
      result = NotifService.process_message("ci.failure", payload)

      # Assert
      assert {:error, %NotificationService.RetryableError{}} = result
    end
  end
end
