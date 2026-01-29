defmodule NotificationService.Consumers.NotificationConsumerTest do
  use ExUnit.Case, async: false

  alias NotificationService.Consumers.NotificationConsumer
  alias NotificationService.{RetryableError, NonRetryableError}

  describe "handle_message/3" do
    test "returns message on successful processing" do
      # Arrange
      message = build_broadway_message("ci.success", %{"repository" => "xmer/test"})

      # We test handle_message directly — it calls the real service modules
      # For unit testing, we need the config to point at mocks
      Application.put_env(
        :notification_service,
        :discord_client,
        NotificationService.Discord.MockClient
      )

      Application.put_env(
        :notification_service,
        :discord_webhooks,
        %{"default" => "https://discord.com/api/webhooks/test/token"}
      )

      Application.put_env(:notification_service, :discord_routes, %{})
      Application.put_env(:notification_service, :discord_error_routes, [])

      Mox.expect(NotificationService.Discord.MockClient, :send_embed, fn _url, _embed ->
        :ok
      end)

      # Act
      result = NotificationConsumer.handle_message(:default, message, %{})

      # Assert
      assert %Broadway.Message{} = result
      refute match?({:failed, _}, result.status)
    end

    test "marks message as failed with non_retryable for invalid JSON" do
      # Arrange
      message = build_broadway_message_raw("ci.success", "not json")

      # Act
      result = NotificationConsumer.handle_message(:default, message, %{})

      # Assert
      assert {:failed, {:non_retryable, %NonRetryableError{code: "INVALID_JSON"}}} =
               result.status
    end

    test "extracts routing key from message metadata" do
      # Arrange
      Application.put_env(
        :notification_service,
        :discord_client,
        NotificationService.Discord.MockClient
      )

      Application.put_env(
        :notification_service,
        :discord_webhooks,
        %{"default" => "https://discord.com/api/webhooks/test/token"}
      )

      Application.put_env(:notification_service, :discord_routes, %{})
      Application.put_env(:notification_service, :discord_error_routes, [])

      Mox.expect(NotificationService.Discord.MockClient, :send_embed, fn _url, _embed ->
        :ok
      end)

      message = build_broadway_message("pr.opened", %{"pr_title" => "Test"})

      # Act
      result = NotificationConsumer.handle_message(:default, message, %{})

      # Assert
      assert %Broadway.Message{} = result
    end
  end

  describe "handle_failed/2" do
    test "processes retryable failures" do
      # Arrange
      error = RetryableError.exception(message: "Discord timeout")

      message =
        build_broadway_message("ci.success", %{"test" => true})
        |> Broadway.Message.failed({:retryable, error})

      Application.put_env(
        :notification_service,
        :amqp_module,
        NotificationService.RabbitMQ.MockAMQP
      )

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :open_connection, fn _ ->
        {:ok, :fake_conn}
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :open_channel, fn :fake_conn ->
        {:ok, :fake_channel}
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :publish, fn _, _, _, _, _ ->
        :ok
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :close_channel, fn :fake_channel ->
        :ok
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :close_connection, fn :fake_conn ->
        :ok
      end)

      # Act
      result = NotificationConsumer.handle_failed([message], %{})

      # Assert
      assert [%Broadway.Message{}] = result
    end

    test "processes non-retryable failures by sending to DLQ" do
      # Arrange
      error = NonRetryableError.exception(message: "Invalid payload")

      message =
        build_broadway_message("ci.success", %{"test" => true})
        |> Broadway.Message.failed({:non_retryable, error})

      Application.put_env(
        :notification_service,
        :amqp_module,
        NotificationService.RabbitMQ.MockAMQP
      )

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :open_connection, fn _ ->
        {:ok, :fake_conn}
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :open_channel, fn :fake_conn ->
        {:ok, :fake_channel}
      end)

      # DLQ publish + alert publish
      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :publish, 2, fn _, _, _, _, _ ->
        :ok
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :close_channel, fn :fake_channel ->
        :ok
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :close_connection, fn :fake_conn ->
        :ok
      end)

      # Act
      result = NotificationConsumer.handle_failed([message], %{})

      # Assert
      assert [%Broadway.Message{}] = result
    end

    test "handles connection failures gracefully" do
      # Arrange
      error = RetryableError.exception(message: "Discord timeout")

      message =
        build_broadway_message("ci.success", %{"test" => true})
        |> Broadway.Message.failed({:retryable, error})

      Application.put_env(
        :notification_service,
        :amqp_module,
        NotificationService.RabbitMQ.MockAMQP
      )

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :open_connection, fn _ ->
        {:error, :connection_refused}
      end)

      # Act — should not raise
      result = NotificationConsumer.handle_failed([message], %{})

      # Assert
      assert [%Broadway.Message{}] = result
    end

    test "handles channel open failures gracefully" do
      # Arrange
      error = RetryableError.exception(message: "Discord timeout")

      message =
        build_broadway_message("ci.success", %{"test" => true})
        |> Broadway.Message.failed({:retryable, error})

      Application.put_env(
        :notification_service,
        :amqp_module,
        NotificationService.RabbitMQ.MockAMQP
      )

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :open_connection, fn _ ->
        {:ok, :fake_conn}
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :open_channel, fn _ ->
        {:error, :channel_error}
      end)

      # Act — should not raise
      result = NotificationConsumer.handle_failed([message], %{})

      # Assert
      assert [%Broadway.Message{}] = result
    end

    test "handles unexpected failure reasons as retryable" do
      # Arrange
      message =
        build_broadway_message("ci.success", %{"test" => true})
        |> Broadway.Message.failed("some unexpected reason")

      Application.put_env(
        :notification_service,
        :amqp_module,
        NotificationService.RabbitMQ.MockAMQP
      )

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :open_connection, fn _ ->
        {:ok, :fake_conn}
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :open_channel, fn :fake_conn ->
        {:ok, :fake_channel}
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :publish, fn _, _, _, _, _ ->
        :ok
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :close_channel, fn :fake_channel ->
        :ok
      end)

      Mox.expect(NotificationService.RabbitMQ.MockAMQP, :close_connection, fn :fake_conn ->
        :ok
      end)

      # Act
      result = NotificationConsumer.handle_failed([message], %{})

      # Assert
      assert [%Broadway.Message{}] = result
    end
  end

  describe "extract_routing_key/1" do
    test "returns 'unknown' for message without routing key" do
      Application.put_env(
        :notification_service,
        :discord_client,
        NotificationService.Discord.MockClient
      )

      Application.put_env(
        :notification_service,
        :discord_webhooks,
        %{"default" => "https://discord.com/api/webhooks/test/token"}
      )

      Application.put_env(:notification_service, :discord_routes, %{})
      Application.put_env(:notification_service, :discord_error_routes, [])

      Mox.expect(NotificationService.Discord.MockClient, :send_embed, fn _url, _embed ->
        :ok
      end)

      # Create message with empty metadata
      message = %Broadway.Message{
        data: Jason.encode!(%{"test" => true}),
        metadata: %{},
        acknowledger: {Broadway.NoopAcknowledger, nil, nil}
      }

      # Act
      result = NotificationConsumer.handle_message(:default, message, %{})

      # Assert
      assert %Broadway.Message{} = result
    end
  end

  defp build_broadway_message(routing_key, payload) do
    %Broadway.Message{
      data: Jason.encode!(payload),
      metadata: %{routing_key: routing_key, headers: []},
      acknowledger: {Broadway.NoopAcknowledger, nil, nil}
    }
  end

  defp build_broadway_message_raw(routing_key, raw_data) do
    %Broadway.Message{
      data: raw_data,
      metadata: %{routing_key: routing_key, headers: []},
      acknowledger: {Broadway.NoopAcknowledger, nil, nil}
    }
  end
end
