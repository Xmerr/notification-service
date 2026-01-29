defmodule NotificationService.RabbitMQ.Setup do
  @moduledoc """
  Asserts all RabbitMQ exchanges, queues, and bindings on startup.
  Runs as a Task under the supervision tree.
  """

  use Task, restart: :transient

  require Logger

  alias NotificationService.Config

  @spec start_link(keyword()) :: {:ok, pid()}
  def start_link(opts \\ []) do
    Task.start_link(__MODULE__, :run, [opts])
  end

  @spec run(keyword()) :: :ok
  def run(_opts \\ []) do
    url = Config.rabbitmq_url()
    exchange = Config.exchange_name()
    queue = Config.queue_name()
    dlq_exchange = Config.dlq_exchange_name()
    delay_exchange = Config.delay_exchange_name()

    {:ok, conn} = AMQP.Connection.open(url)
    {:ok, chan} = AMQP.Channel.open(conn)

    try do
      setup_exchanges(chan, exchange, dlq_exchange, delay_exchange)
      setup_queues(chan, queue, exchange, dlq_exchange, delay_exchange)
      setup_exchange_bindings(chan, exchange)

      Logger.info("RabbitMQ setup complete",
        exchange: exchange,
        queue: queue,
        dlq_exchange: dlq_exchange,
        delay_exchange: delay_exchange
      )

      :ok
    after
      AMQP.Channel.close(chan)
      AMQP.Connection.close(conn)
    end
  end

  defp setup_exchanges(chan, exchange, dlq_exchange, delay_exchange) do
    :ok = AMQP.Exchange.declare(chan, exchange, :topic, durable: true)
    :ok = AMQP.Exchange.declare(chan, dlq_exchange, :topic, durable: true)

    :ok =
      AMQP.Exchange.declare(chan, delay_exchange, :"x-delayed-message",
        durable: true,
        arguments: [{"x-delayed-type", :longstr, "topic"}]
      )

    Logger.debug("Exchanges declared",
      exchanges: [exchange, dlq_exchange, delay_exchange]
    )
  end

  defp setup_queues(chan, queue, exchange, dlq_exchange, delay_exchange) do
    {:ok, _} = AMQP.Queue.declare(chan, queue, durable: true)
    :ok = AMQP.Queue.bind(chan, queue, exchange, routing_key: "#")
    :ok = AMQP.Queue.bind(chan, queue, delay_exchange, routing_key: "#")

    dlq_queue = "#{queue}.dlq"
    {:ok, _} = AMQP.Queue.declare(chan, dlq_queue, durable: true)
    :ok = AMQP.Queue.bind(chan, dlq_queue, dlq_exchange, routing_key: "#")

    Logger.debug("Queues declared and bound",
      queues: [queue, dlq_queue]
    )
  end

  defp setup_exchange_bindings(chan, exchange) do
    :ok = AMQP.Exchange.bind(chan, exchange, "github", routing_key: "ci.#")
    :ok = AMQP.Exchange.bind(chan, exchange, "github", routing_key: "pr.#")

    Logger.debug("Exchange-to-exchange bindings established",
      source: "github",
      destination: exchange,
      routing_keys: ["ci.#", "pr.#"]
    )
  end
end
