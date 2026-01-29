defmodule NotificationService.RabbitMQ.AMQPBehaviour do
  @moduledoc """
  Behaviour for AMQP operations, enabling testability via Mox.
  """

  @callback publish(
              channel :: AMQP.Channel.t(),
              exchange :: String.t(),
              routing_key :: String.t(),
              payload :: binary(),
              options :: keyword()
            ) :: :ok | {:error, term()}

  @callback open_connection(uri :: String.t()) :: {:ok, AMQP.Connection.t()} | {:error, term()}
  @callback open_channel(conn :: AMQP.Connection.t()) ::
              {:ok, AMQP.Channel.t()} | {:error, term()}
  @callback close_channel(channel :: AMQP.Channel.t()) :: :ok | {:error, term()}
  @callback close_connection(conn :: AMQP.Connection.t()) :: :ok | {:error, term()}
end

defmodule NotificationService.RabbitMQ.AMQP do
  @moduledoc """
  Production AMQP wrapper delegating to the amqp library.
  """

  @behaviour NotificationService.RabbitMQ.AMQPBehaviour

  @impl true
  def publish(channel, exchange, routing_key, payload, options) do
    AMQP.Basic.publish(channel, exchange, routing_key, payload, options)
  end

  @impl true
  def open_connection(uri) do
    AMQP.Connection.open(uri)
  end

  @impl true
  def open_channel(conn) do
    AMQP.Channel.open(conn)
  end

  @impl true
  def close_channel(channel) do
    AMQP.Channel.close(channel)
  end

  @impl true
  def close_connection(conn) do
    AMQP.Connection.close(conn)
  end
end
