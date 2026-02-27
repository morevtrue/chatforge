import Config

# В prod все секреты читаются из runtime.exs через env-переменные.
# Этот файл содержит только статические настройки.

config :chatforge, ChatForgeWeb.Endpoint,
  cache_static_manifest: "priv/static/cache_manifest.json",
  server: true

config :logger, level: :info

config :phoenix, :serve_endpoints, true
