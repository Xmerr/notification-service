defmodule NotificationService.Publishers.DlqPublisherTest do
  use ExUnit.Case, async: false

  import Mox

  alias NotificationService.Publishers.DlqPublisher
  alias NotificationService.{RetryableError, NonRetryableError}
  alias NotificationService.RabbitMQ.MockAMQP

  setup :verify_on_exit!

  setup do
    Application.put_env(:notification_service, :amqp_module, MockAMQP)

    on_exit(fn ->
      Application.put_env(:notification_service, :amqp_module, MockAMQP)
    end)

    :ok
  end

  describe "calculate_backoff/1" do
    test "returns 0 for first retry" do
      assert DlqPublisher.calculate_backoff(0) == 0
    end

    test "returns 1000ms for second retry" do
      assert DlqPublisher.calculate_backoff(1) == 1_000
    end

    test "returns 2000ms for third retry" do
      assert DlqPublisher.calculate_backoff(2) == 2_000
    end

    test "returns 4000ms for fourth retry" do
      assert DlqPublisher.calculate_backoff(3) == 4_000
    end

    test "doubles each subsequent retry" do
      assert DlqPublisher.calculate_backoff(4) == 8_000
      assert DlqPublisher.calculate_backoff(5) == 16_000
      assert DlqPublisher.calculate_backoff(6) == 32_000
    end

    test "caps at max backoff" do
      result = DlqPublisher.calculate_backoff(30)

      assert result <= 57_600_000
    end
  end

  describe "retry_message/3" do
    test "publishes to delay exchange when retry count below max" do
      # Arrange
      channel = :fake_channel
      message = %{routing_key: "ci.success", payload: ~s({"test":true}), headers: []}
      error = RetryableError.exception(message: "Discord timeout")

      MockAMQP
      |> expect(:publish, fn ^channel, "notifications.delay", "ci.success", _, opts ->
        headers = Keyword.get(opts, :headers, [])
        assert List.keyfind(headers, "x-retry-count", 0) == {"x-retry-count", :long, 1}
        assert List.keyfind(headers, "x-delay", 0) == {"x-delay", :long, 0}
        :ok
      end)

      # Act
      result = DlqPublisher.retry_message(channel, message, error)

      # Assert
      assert result == :ok
    end

    test "publishes to DLQ when retry count reaches max" do
      # Arrange
      channel = :fake_channel

      message = %{
        routing_key: "ci.success",
        payload: ~s({"test":true}),
        headers: [{"x-retry-count", :long, 20}]
      }

      error = RetryableError.exception(message: "Discord timeout")

      # DLQ publish + alert publish
      MockAMQP
      |> expect(:publish, fn ^channel, "notifications.dlq", "ci.success", _, _ -> :ok end)
      |> expect(:publish, fn ^channel,
                             "notifications",
                             "notifications.dlq.notification-service",
                             alert_body,
                             _ ->
        alert = Jason.decode!(alert_body)
        assert alert["service"] == "notification-service"
        assert alert["error"] == "Discord timeout"
        :ok
      end)

      # Act
      result = DlqPublisher.retry_message(channel, message, error)

      # Assert
      assert result == :ok
    end

    test "increments retry count on each retry" do
      # Arrange
      channel = :fake_channel

      message = %{
        routing_key: "ci.success",
        payload: ~s({"test":true}),
        headers: [{"x-retry-count", :long, 5}]
      }

      error = RetryableError.exception(message: "Discord timeout")

      MockAMQP
      |> expect(:publish, fn ^channel, "notifications.delay", _, _, opts ->
        headers = Keyword.get(opts, :headers, [])
        assert List.keyfind(headers, "x-retry-count", 0) == {"x-retry-count", :long, 6}
        :ok
      end)

      # Act
      DlqPublisher.retry_message(channel, message, error)
    end

    test "includes exponential backoff delay" do
      # Arrange
      channel = :fake_channel

      message = %{
        routing_key: "ci.success",
        payload: ~s({"test":true}),
        headers: [{"x-retry-count", :long, 3}]
      }

      error = RetryableError.exception(message: "Discord timeout")

      MockAMQP
      |> expect(:publish, fn ^channel, "notifications.delay", _, _, opts ->
        headers = Keyword.get(opts, :headers, [])
        {_, _, delay} = List.keyfind(headers, "x-delay", 0)
        assert delay == 4_000
        :ok
      end)

      # Act
      DlqPublisher.retry_message(channel, message, error)
    end

    test "preserves first failure timestamp from headers" do
      # Arrange
      channel = :fake_channel
      original_timestamp = "2026-01-01T00:00:00Z"

      message = %{
        routing_key: "ci.success",
        payload: ~s({"test":true}),
        headers: [
          {"x-retry-count", :long, 2},
          {"x-first-failure-timestamp", :longstr, original_timestamp}
        ]
      }

      error = RetryableError.exception(message: "Discord timeout")

      MockAMQP
      |> expect(:publish, fn ^channel, "notifications.delay", _, _, opts ->
        headers = Keyword.get(opts, :headers, [])

        assert List.keyfind(headers, "x-first-failure-timestamp", 0) ==
                 {"x-first-failure-timestamp", :longstr, original_timestamp}

        :ok
      end)

      # Act
      DlqPublisher.retry_message(channel, message, error)
    end
  end

  describe "send_to_dlq/3" do
    test "publishes message to DLQ exchange" do
      # Arrange
      channel = :fake_channel
      message = %{routing_key: "ci.success", payload: ~s({"test":true}), headers: []}
      error = NonRetryableError.exception(message: "Invalid webhook")

      MockAMQP
      |> expect(:publish, fn ^channel, "notifications.dlq", "ci.success", _, opts ->
        assert Keyword.get(opts, :persistent) == true
        :ok
      end)
      |> expect(:publish, fn ^channel,
                             "notifications",
                             "notifications.dlq.notification-service",
                             _,
                             _ ->
        :ok
      end)

      # Act
      result = DlqPublisher.send_to_dlq(channel, message, error)

      # Assert
      assert result == :ok
    end

    test "publishes DLQ alert to notifications exchange" do
      # Arrange
      channel = :fake_channel
      message = %{routing_key: "ci.success", payload: ~s({"test":true}), headers: []}
      error = NonRetryableError.exception(message: "Invalid webhook")

      MockAMQP
      |> expect(:publish, fn ^channel, "notifications.dlq", _, _, _ -> :ok end)
      |> expect(:publish, fn ^channel,
                             "notifications",
                             "notifications.dlq.notification-service",
                             alert_body,
                             opts ->
        alert = Jason.decode!(alert_body)
        assert alert["service"] == "notification-service"
        assert alert["queue"] == "notifications"
        assert alert["error"] == "Invalid webhook"
        assert alert["retryCount"] == 0
        assert is_binary(alert["timestamp"])
        assert Keyword.get(opts, :content_type) == "application/json"
        :ok
      end)

      # Act
      DlqPublisher.send_to_dlq(channel, message, error)
    end

    test "includes retry count in DLQ message headers" do
      # Arrange
      channel = :fake_channel

      message = %{
        routing_key: "ci.success",
        payload: ~s({"test":true}),
        headers: [{"x-retry-count", :long, 15}]
      }

      error = RetryableError.exception(message: "Discord timeout")

      MockAMQP
      |> expect(:publish, fn ^channel, "notifications.dlq", _, _, opts ->
        headers = Keyword.get(opts, :headers, [])
        assert List.keyfind(headers, "x-retry-count", 0) == {"x-retry-count", :long, 15}

        assert List.keyfind(headers, "x-last-error", 0) ==
                 {"x-last-error", :longstr, "Discord timeout"}

        :ok
      end)
      |> expect(:publish, fn ^channel, "notifications", _, _, _ -> :ok end)

      # Act
      DlqPublisher.send_to_dlq(channel, message, error)
    end

    test "truncates long original messages in alert" do
      # Arrange
      channel = :fake_channel
      long_payload = String.duplicate("a", 600)
      message = %{routing_key: "ci.success", payload: long_payload, headers: []}
      error = NonRetryableError.exception(message: "Error")

      MockAMQP
      |> expect(:publish, fn ^channel, "notifications.dlq", _, _, _ -> :ok end)
      |> expect(:publish, fn ^channel, "notifications", _, alert_body, _ ->
        alert = Jason.decode!(alert_body)
        assert String.length(alert["originalMessage"]) <= 503
        assert String.ends_with?(alert["originalMessage"], "...")
        :ok
      end)

      # Act
      DlqPublisher.send_to_dlq(channel, message, error)
    end
  end
end
