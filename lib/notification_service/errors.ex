defmodule NotificationService.RetryableError do
  @moduledoc """
  Transient failures that should be retried: network timeouts, Discord 5xx, rate limits.
  """

  defexception [:message, :code, :context]

  @type t :: %__MODULE__{
          message: String.t(),
          code: String.t(),
          context: map()
        }

  @impl true
  def exception(opts) do
    %__MODULE__{
      message: Keyword.fetch!(opts, :message),
      code: Keyword.get(opts, :code, "RETRYABLE"),
      context: Keyword.get(opts, :context, %{})
    }
  end
end

defmodule NotificationService.NonRetryableError do
  @moduledoc """
  Permanent failures that should not be retried: malformed message, invalid webhook, Discord 4xx.
  """

  defexception [:message, :code, :context]

  @type t :: %__MODULE__{
          message: String.t(),
          code: String.t(),
          context: map()
        }

  @impl true
  def exception(opts) do
    %__MODULE__{
      message: Keyword.fetch!(opts, :message),
      code: Keyword.get(opts, :code, "NON_RETRYABLE"),
      context: Keyword.get(opts, :context, %{})
    }
  end
end
