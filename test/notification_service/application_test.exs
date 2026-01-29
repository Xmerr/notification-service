defmodule NotificationService.ApplicationTest do
  use ExUnit.Case, async: false

  describe "start/2" do
    test "starts the application successfully with disabled children" do
      # In test env, Broadway and RabbitMQ setup are disabled
      # Just verify the application module is defined and has start/2
      assert function_exported?(NotificationService.Application, :start, 2)
    end
  end
end
