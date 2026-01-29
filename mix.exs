defmodule NotificationService.MixProject do
  use Mix.Project

  def project do
    [
      app: :notification_service,
      version: "0.1.0",
      elixir: "~> 1.17",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      aliases: aliases(),
      test_coverage: [
        tool: ExCoveralls,
        summary: [threshold: 95]
      ],
      preferred_cli_env: [
        coveralls: :test,
        "coveralls.detail": :test,
        "coveralls.html": :test,
        "coveralls.json": :test
      ],
      dialyzer: [
        plt_add_apps: [:mix, :ex_unit]
      ]
    ]
  end

  def application do
    [
      extra_applications: [:logger],
      mod: {NotificationService.Application, []}
    ]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      {:broadway, "~> 1.2"},
      {:broadway_rabbitmq, "~> 0.8"},
      {:amqp, "~> 3.3"},
      {:req, "~> 0.5"},
      {:jason, "~> 1.4"},
      {:keen_loki_logger, "~> 0.5", only: [:dev, :prod]},
      {:mox, "~> 1.0", only: :test},
      {:plug, "~> 1.16", only: :test},
      {:bypass, "~> 2.1", only: :test},
      {:excoveralls, "~> 0.18", only: :test},
      {:dialyxir, "~> 1.4", only: [:dev, :test], runtime: false}
    ]
  end

  defp aliases do
    [
      "test.coverage": ["coveralls"],
      lint: ["format --check-formatted", "dialyzer"]
    ]
  end
end
