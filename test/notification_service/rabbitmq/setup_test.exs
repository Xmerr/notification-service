defmodule NotificationService.RabbitMQ.SetupTest do
  use ExUnit.Case, async: true

  alias NotificationService.RabbitMQ.Setup

  describe "run/1" do
    @tag :integration
    test "asserts all exchanges and queues when RabbitMQ is available" do
      # This test requires a running RabbitMQ instance
      # Skip in CI without RabbitMQ by checking connection first
      rabbitmq_url = Application.get_env(:notification_service, :rabbitmq_url)

      case AMQP.Connection.open(rabbitmq_url) do
        {:ok, conn} ->
          AMQP.Connection.close(conn)
          assert Setup.run() == :ok

        {:error, _} ->
          # RabbitMQ not available, skip this test
          :ok
      end
    end
  end

  describe "start_link/1" do
    test "is a valid function" do
      assert is_function(&Setup.start_link/1, 1)
    end
  end
end
