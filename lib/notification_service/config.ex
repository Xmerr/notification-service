defmodule NotificationService.Config do
  @moduledoc """
  Runtime configuration access and validation.
  """

  @spec rabbitmq_url() :: String.t()
  def rabbitmq_url do
    Application.fetch_env!(:notification_service, :rabbitmq_url)
  end

  @spec queue_name() :: String.t()
  def queue_name do
    Application.get_env(:notification_service, :queue_name, "notifications")
  end

  @spec exchange_name() :: String.t()
  def exchange_name do
    Application.get_env(:notification_service, :exchange_name, "notifications")
  end

  @spec dlq_exchange_name() :: String.t()
  def dlq_exchange_name do
    Application.get_env(:notification_service, :dlq_exchange_name, "notifications.dlq")
  end

  @spec delay_exchange_name() :: String.t()
  def delay_exchange_name do
    Application.get_env(:notification_service, :delay_exchange_name, "notifications.delay")
  end

  @spec max_retries() :: non_neg_integer()
  def max_retries do
    Application.get_env(:notification_service, :max_retries, 20)
  end

  @spec max_backoff_ms() :: non_neg_integer()
  def max_backoff_ms do
    Application.get_env(:notification_service, :max_backoff_ms, 57_600_000)
  end

  @spec discord_webhooks() :: %{String.t() => String.t()}
  def discord_webhooks do
    Application.get_env(:notification_service, :discord_webhooks, %{"default" => ""})
  end

  @spec discord_routes() :: %{String.t() => String.t()}
  def discord_routes do
    Application.get_env(:notification_service, :discord_routes, %{})
  end

  @spec discord_error_routes() :: [String.t()]
  def discord_error_routes do
    Application.get_env(:notification_service, :discord_error_routes, [
      "ci.failure",
      "deploy.failure",
      "dlq",
      "polling.failure"
    ])
  end

  @spec discord_client() :: module()
  def discord_client do
    Application.get_env(
      :notification_service,
      :discord_client,
      NotificationService.Discord.Client
    )
  end

  @spec start_broadway?() :: boolean()
  def start_broadway? do
    Application.get_env(:notification_service, :start_broadway, true)
  end

  @spec start_rabbitmq_setup?() :: boolean()
  def start_rabbitmq_setup? do
    Application.get_env(:notification_service, :start_rabbitmq_setup, true)
  end
end
