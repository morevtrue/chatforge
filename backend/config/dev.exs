import Config

# Настройка базы данных для разработки
# В Docker используется DATABASE_URL, локально — отдельные переменные
if database_url = System.get_env("DATABASE_URL") do
  config :chatforge, ChatForge.Repo,
    url: database_url,
    stacktrace: true,
    show_sensitive_data_on_connection_error: true,
    pool_size: 10
else
  config :chatforge, ChatForge.Repo,
    username: System.get_env("DB_USERNAME", "chatforge"),
    password: System.get_env("DB_PASSWORD", "chatforge"),
    hostname: System.get_env("DB_HOST", "localhost"),
    port: String.to_integer(System.get_env("DB_PORT", "5433")),
    database: "chatforge_dev",
    stacktrace: true,
    show_sensitive_data_on_connection_error: true,
    pool_size: 10
end

# Настройка Phoenix endpoint для разработки
config :chatforge, ChatForgeWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 4000],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "dev_secret_key_base_min_64_chars_long_replace_in_production_please",
  watchers: [],
  live_reload: [
    patterns: [
      ~r"priv/static/.*(js|css|png|jpeg|jpg|gif|svg)$",
      ~r"lib/chatforge_web/(controllers|live|components)/.*(ex|heex)$"
    ]
  ]

# Guardian — секрет для dev окружения
config :chatforge, ChatForge.Guardian,
  secret_key: System.get_env("GUARDIAN_SECRET_KEY", "dev_guardian_secret_key_min_64_chars_long_replace_in_production_xx")

# Уровень логирования в dev
config :logger, level: :debug

# Не инициализировать plugs при компиляции
config :phoenix, :plug_init_mode, :runtime
