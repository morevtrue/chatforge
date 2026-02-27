import Config

# Настройка Phoenix endpoint
config :chatforge, ChatForgeWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Phoenix.Endpoint.Cowboy2Adapter,
  render_errors: [
    formats: [json: ChatForgeWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: ChatForge.PubSub,
  live_view: [signing_salt: "chatforge"]

# Настройка JSON-кодировщика
config :phoenix, :json_library, Jason

# Настройка Ecto repo
config :chatforge, ecto_repos: [ChatForge.Repo]

# Настройка логгера
config :logger, :console,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

# Настройка Guardian — секрет и TTL задаются в runtime.exs
config :chatforge, ChatForge.Guardian,
  issuer: "chatforge",
  secret_key: System.get_env("GUARDIAN_SECRET_KEY", "dev_secret_change_in_production")

# Настройка Oban — очереди и cron-задачи
config :chatforge, Oban,
  repo: ChatForge.Repo,
  queues: [
    default: 10,
    billing: 5
  ],
  plugins: [
    {Oban.Plugins.Cron,
     crontab: [
       # Истечение подписок — ежедневно в 00:00 UTC
       {"0 0 * * *", ChatForge.Billing.ExpireSubscriptionsJob}
     ]}
  ]

# Подключаем конфигурацию для текущего окружения
import_config "#{config_env()}.exs"
