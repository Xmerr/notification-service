defmodule NotificationService.Discord.FormatterTest do
  use ExUnit.Case, async: true

  alias NotificationService.Discord.Formatter
  alias NotificationService.Test.Fixtures

  describe "format/2 - CI messages" do
    test "formats ci.success with green color" do
      # Arrange
      payload = Fixtures.ci_success_payload()

      # Act
      embed = Formatter.format("ci.success", payload)

      # Assert
      assert embed.title == "CI: xmer/test-repo"
      assert embed.color == 0x00FF00
      assert embed.url == "https://github.com/xmer/test-repo/actions/runs/123"
      assert length(embed.fields) == 2

      assert Enum.find(embed.fields, &(&1.name == "Status")).value == "complete"
      assert Enum.find(embed.fields, &(&1.name == "Result")).value == "success"
    end

    test "formats ci.failure with red color" do
      # Arrange
      payload = Fixtures.ci_failure_payload()

      # Act
      embed = Formatter.format("ci.failure", payload)

      # Assert
      assert embed.title == "CI: xmer/test-repo"
      assert embed.color == 0xFF0000

      assert Enum.find(embed.fields, &(&1.name == "Result")).value == "failure"
    end

    test "handles missing repository with default" do
      # Arrange
      payload = %{}

      # Act
      embed = Formatter.format("ci.success", payload)

      # Assert
      assert embed.title == "CI: unknown"
    end
  end

  describe "format/2 - PR messages" do
    test "formats pr.opened with yellow color" do
      # Arrange
      payload = Fixtures.pr_opened_payload()

      # Act
      embed = Formatter.format("pr.opened", payload)

      # Assert
      assert embed.title == "PR #42: Add new feature"
      assert embed.description == "opened by @xmer"
      assert embed.color == 0xFFFF00
      assert embed.url == "https://github.com/xmer/test-repo/pull/42"
    end

    test "formats pr.merged with purple color" do
      # Arrange
      payload = Fixtures.pr_merged_payload()

      # Act
      embed = Formatter.format("pr.merged", payload)

      # Assert
      assert embed.color == 0x800080
      assert embed.description == "merged by @xmer"
    end

    test "formats pr.closed with red color" do
      # Arrange
      payload = Fixtures.pr_closed_payload()

      # Act
      embed = Formatter.format("pr.closed", payload)

      # Assert
      assert embed.color == 0xFF0000
      assert embed.description == "closed by @xmer"
    end
  end

  describe "format/2 - download messages" do
    test "formats downloads.complete with green color and size fields" do
      # Arrange
      payload = Fixtures.download_complete_payload()

      # Act
      embed = Formatter.format("downloads.complete", payload)

      # Assert
      assert embed.title == "Download Complete: Example.Torrent"
      assert embed.color == 0x00FF00

      size_field = Enum.find(embed.fields, &(&1.name == "Size"))
      assert size_field.value == "1.0 GB"

      category_field = Enum.find(embed.fields, &(&1.name == "Category"))
      assert category_field.value == "movies"

      path_field = Enum.find(embed.fields, &(&1.name == "Path"))
      assert path_field.value == "/downloads/movies/Example.Torrent"
    end

    test "formats downloads.removed with orange color" do
      # Arrange
      payload = Fixtures.download_removed_payload()

      # Act
      embed = Formatter.format("downloads.removed", payload)

      # Assert
      assert embed.title == "Download Removed: Example.Torrent"
      assert embed.color == 0xFF8C00
    end

    test "formats size in MB" do
      # Arrange
      payload = Fixtures.download_complete_payload(%{"size" => 5_242_880})

      # Act
      embed = Formatter.format("downloads.complete", payload)

      # Assert
      size_field = Enum.find(embed.fields, &(&1.name == "Size"))
      assert size_field.value == "5.0 MB"
    end

    test "formats size in KB" do
      # Arrange
      payload = Fixtures.download_complete_payload(%{"size" => 2048})

      # Act
      embed = Formatter.format("downloads.complete", payload)

      # Assert
      size_field = Enum.find(embed.fields, &(&1.name == "Size"))
      assert size_field.value == "2.0 KB"
    end

    test "formats size in bytes" do
      # Arrange
      payload = Fixtures.download_complete_payload(%{"size" => 512})

      # Act
      embed = Formatter.format("downloads.complete", payload)

      # Assert
      size_field = Enum.find(embed.fields, &(&1.name == "Size"))
      assert size_field.value == "512 B"
    end

    test "omits nil fields" do
      # Arrange
      payload = %{"name" => "Test"}

      # Act
      embed = Formatter.format("downloads.complete", payload)

      # Assert
      assert embed.title == "Download Complete: Test"
      assert embed.fields == []
    end
  end

  describe "format/2 - deploy messages" do
    test "formats deploy.success with green color" do
      # Arrange
      payload = Fixtures.deploy_success_payload()

      # Act
      embed = Formatter.format("deploy.success", payload)

      # Assert
      assert embed.title == "Deploy: xmer/test-repo"
      assert embed.color == 0x00FF00

      status_field = Enum.find(embed.fields, &(&1.name == "Status"))
      assert status_field.value == "success"

      duration_field = Enum.find(embed.fields, &(&1.name == "Duration"))
      assert duration_field.value == "45s"
    end

    test "formats deploy.failure with red color" do
      # Arrange
      payload = Fixtures.deploy_failure_payload()

      # Act
      embed = Formatter.format("deploy.failure", payload)

      # Assert
      assert embed.title == "Deploy: xmer/test-repo"
      assert embed.color == 0xFF0000
    end

    test "omits duration field when not present" do
      # Arrange
      payload = %{"repository" => "xmer/test-repo"}

      # Act
      embed = Formatter.format("deploy.success", payload)

      # Assert
      refute Enum.any?(embed.fields, &(&1.name == "Duration"))
    end
  end

  describe "format/2 - DLQ alerts" do
    test "formats DLQ alert with service name and retry count" do
      # Arrange
      payload = Fixtures.dlq_alert_payload()

      # Act
      embed = Formatter.format("dlq.qbittorrent", payload)

      # Assert
      assert embed.title == "DLQ Alert: qbittorrent-consumer"
      assert embed.description == "downloads.add queue exceeded retry limit"
      assert embed.color == 0xFF0000

      retries_field = Enum.find(embed.fields, &(&1.name == "Retries"))
      assert retries_field.value == "20"

      queue_field = Enum.find(embed.fields, &(&1.name == "Queue"))
      assert queue_field.value == "downloads.add"

      error_field = Enum.find(embed.fields, &(&1.name == "Error"))
      assert error_field.value == "qBittorrent API timeout"
    end
  end

  describe "format/2 - polling failure" do
    test "formats polling failure with error details" do
      # Arrange
      payload = Fixtures.polling_failure_payload()

      # Act
      embed = Formatter.format("polling.failure", payload)

      # Assert
      assert embed.title == "Polling Failure: qbittorrent-consumer"
      assert embed.color == 0xFF0000

      error_field = Enum.find(embed.fields, &(&1.name == "Error"))
      assert error_field.value == "qBittorrent API unreachable for 10+ minutes"
    end
  end

  describe "format/2 - unknown messages" do
    test "formats unknown routing key with raw JSON payload" do
      # Arrange
      payload = %{"foo" => "bar"}

      # Act
      embed = Formatter.format("some.unknown.key", payload)

      # Assert
      assert embed.title == "Notification"
      assert embed.color == 0x0099FF
      assert String.contains?(embed.description, "foo")
    end

    test "formats unknown with non-serializable payload using inspect" do
      # Arrange - create a payload that Jason can't encode
      # A function reference cannot be encoded
      payload = %{func: &String.length/1}

      # Act
      embed = Formatter.format("some.unknown.key", payload)

      # Assert
      assert embed.title == "Notification"
      assert is_binary(embed.description)
    end
  end

  describe "format_bytes edge cases" do
    test "handles non-numeric size gracefully" do
      # Arrange
      payload = %{"name" => "Test", "size" => "not a number"}

      # Act
      embed = Formatter.format("downloads.complete", payload)

      # Assert
      size_field = Enum.find(embed.fields, &(&1.name == "Size"))
      assert size_field.value == "Unknown"
    end
  end
end
