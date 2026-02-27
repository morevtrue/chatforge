defmodule ChatForge.MixProject do
  use Mix.Project

  def project do
    [
      app: :chatforge,
      version: "0.1.0",
      elixir: "~> 1.17",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps()
    ]
  end

  # Конфигурация OTP-приложения
  def application do
    [
      mod: {ChatForge.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  # Пути компиляции: в тестах включаем support/
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      # Phoenix и веб
      {:phoenix, "~> 1.7"},
      {:phoenix_ecto, "~> 4.6"},
      {:ecto_sql, "~> 3.12"},
      {:postgrex, "~> 0.19"},
      {:phoenix_html, "~> 4.1"},
      {:plug_cowboy, "~> 2.7"},
      {:jason, "~> 1.4"},
      {:cors_plug, "~> 3.0"},

      # Аутентификация и авторизация
      {:guardian, "~> 2.3"},
      {:bcrypt_elixir, "~> 3.1"},
      {:bodyguard, "~> 2.4"},

      # Redis
      {:redix, "~> 1.5"},

      # Фоновые задачи
      {:oban, "~> 2.18"},

      # HTTP-клиент
      {:req, "~> 0.5"},

      # AWS / S3-совместимое хранилище
      {:ex_aws, "~> 2.5"},
      {:ex_aws_s3, "~> 2.5"},
      {:hackney, "~> 1.20"},
      {:sweet_xml, "~> 0.7"},

      # Телеметрия
      {:telemetry_metrics, "~> 1.0"},
      {:telemetry_poller, "~> 1.1"},

      # Тестирование
      {:stream_data, "~> 1.1", only: [:test, :dev]},

      # Инструменты разработки
      {:phoenix_live_reload, "~> 1.5", only: :dev}
    ]
  end

  defp aliases do
    [
      setup: ["deps.get", "ecto.setup"],
      "ecto.setup": ["ecto.create", "ecto.migrate"],
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"]
    ]
  end
end
