defmodule NotificationService.Application do
  @moduledoc """
  OTP Application supervision tree.

  Starts the RabbitMQ setup task (to assert exchanges/queues) and
  the Broadway consumer pipeline.
  """

  use Application

  alias NotificationService.Config

  @impl true
  @spec start(Application.start_type(), term()) :: {:ok, pid()} | {:error, term()}
  def start(_type, _args) do
    children =
      []
      |> maybe_add_rabbitmq_setup()
      |> maybe_add_broadway()

    opts = [strategy: :one_for_one, name: NotificationService.Supervisor]
    Supervisor.start_link(children, opts)
  end

  defp maybe_add_rabbitmq_setup(children) do
    if Config.start_rabbitmq_setup?() do
      children ++ [NotificationService.RabbitMQ.Setup]
    else
      children
    end
  end

  defp maybe_add_broadway(children) do
    if Config.start_broadway?() do
      children ++ [NotificationService.Consumers.NotificationConsumer]
    else
      children
    end
  end
end
