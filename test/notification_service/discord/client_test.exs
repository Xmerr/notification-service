defmodule NotificationService.Discord.ClientTest do
  use ExUnit.Case, async: true

  alias NotificationService.Discord.Client
  alias NotificationService.{RetryableError, NonRetryableError}

  @embed %{title: "Test", color: 0x00FF00}

  describe "send_embed/2" do
    test "returns :ok on successful 200 response" do
      # Arrange
      bypass = Bypass.open()

      Bypass.expect_once(bypass, "POST", "/webhooks/test/token", fn conn ->
        Plug.Conn.send_resp(conn, 200, "")
      end)

      # Act
      result = Client.send_embed(endpoint_url(bypass, "/webhooks/test/token"), @embed)

      # Assert
      assert result == :ok
    end

    test "returns :ok on 204 no content response" do
      # Arrange
      bypass = Bypass.open()

      Bypass.expect_once(bypass, "POST", "/webhooks/test/token", fn conn ->
        Plug.Conn.send_resp(conn, 204, "")
      end)

      # Act
      result = Client.send_embed(endpoint_url(bypass, "/webhooks/test/token"), @embed)

      # Assert
      assert result == :ok
    end

    test "returns NonRetryableError on 400 client error" do
      # Arrange
      bypass = Bypass.open()

      Bypass.expect_once(bypass, "POST", "/webhooks/test/token", fn conn ->
        Plug.Conn.send_resp(conn, 400, Jason.encode!(%{message: "Bad Request"}))
      end)

      # Act
      result = Client.send_embed(endpoint_url(bypass, "/webhooks/test/token"), @embed)

      # Assert
      assert {:error, %NonRetryableError{code: "DISCORD_CLIENT_ERROR"}} = result
    end

    test "returns NonRetryableError on 404 not found" do
      # Arrange
      bypass = Bypass.open()

      Bypass.expect_once(bypass, "POST", "/webhooks/test/token", fn conn ->
        Plug.Conn.send_resp(conn, 404, "Not Found")
      end)

      # Act
      result = Client.send_embed(endpoint_url(bypass, "/webhooks/test/token"), @embed)

      # Assert
      assert {:error, %NonRetryableError{}} = result
    end

    test "retries on 500 server error and returns RetryableError after exhaustion" do
      # Arrange
      bypass = Bypass.open()

      # Expect 3 attempts (initial + 2 retries)
      Bypass.expect(bypass, "POST", "/webhooks/test/token", fn conn ->
        Plug.Conn.send_resp(conn, 500, "Internal Server Error")
      end)

      # Act
      result = Client.send_embed(endpoint_url(bypass, "/webhooks/test/token"), @embed)

      # Assert
      assert {:error, %RetryableError{code: "DISCORD_SERVER_ERROR"}} = result
    end

    test "retries on 429 rate limit with retry-after header" do
      # Arrange
      bypass = Bypass.open()
      agent = start_supervised!({Agent, fn -> 0 end})

      Bypass.expect(bypass, "POST", "/webhooks/test/token", fn conn ->
        count = Agent.get_and_update(agent, fn n -> {n, n + 1} end)

        if count == 0 do
          conn
          |> Plug.Conn.put_resp_header("retry-after", "0.001")
          |> Plug.Conn.send_resp(429, Jason.encode!(%{message: "Rate limited"}))
        else
          Plug.Conn.send_resp(conn, 204, "")
        end
      end)

      # Act
      result = Client.send_embed(endpoint_url(bypass, "/webhooks/test/token"), @embed)

      # Assert
      assert result == :ok
      assert Agent.get(agent, & &1) == 2
    end

    test "returns RetryableError on connection refused" do
      # Arrange - use a port that's not listening
      bypass = Bypass.open()
      port = bypass.port
      Bypass.down(bypass)

      # Act
      result = Client.send_embed("http://localhost:#{port}/webhooks/test/token", @embed)

      # Assert
      assert {:error, %RetryableError{code: "DISCORD_TRANSPORT_ERROR"}} = result
    end
  end

  defp endpoint_url(bypass, path) do
    "http://localhost:#{bypass.port}#{path}"
  end
end
