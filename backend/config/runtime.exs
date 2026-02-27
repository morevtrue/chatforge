import Config

# runtime.exs выполняется при старте приложения (не при компиляции).
# Здесь читаем все переменные окружения.

if config_env() == :prod do
  # DATABASE_URL обязательна в production
  database_url = System.fetch_env!("DATABASE_URL")

  config :chatforge, ChatForge.Repo,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE", "10")),
    ssl: String.to_existing_atom(System.get_env("DB_SSL", "false"))

  secret_key_base = System.fetch_env!("SECRET_KEY_BASE")
  port = String.to_integer(System.get_env("PORT", "4000"))

  config :chatforge, ChatForgeWeb.Endpoint,
    http: [ip: {0, 0, 0, 0, 0, 0, 0, 0}, port: port],
    secret_key_base: secret_key_base

  config :chatforge, ChatForge.Guardian,
    secret_key: System.fetch_env!("GUARDIAN_SECRET_KEY")
end

# REDIS_URL с дефолтом для локальной разработки
redis_url = System.get_env("REDIS_URL", "redis://localhost:6379")

config :chatforge, :redis_url, redis_url

# CORS_ORIGINS с дефолтом для Vite dev server
cors_origins =
  System.get_env("CORS_ORIGINS", "http://localhost:5173")
  |> String.split(",")
  |> Enum.map(&String.trim/1)

config :chatforge, :cors_origins, cors_origins

# Конфигурация S3/MinIO для хранения аватаров
config :ex_aws,
  access_key_id:     System.get_env("AWS_ACCESS_KEY_ID", "minioadmin"),
  secret_access_key: System.get_env("AWS_SECRET_ACCESS_KEY", "minioadmin"),
  region:            System.get_env("AWS_REGION", "us-east-1")

config :ex_aws, :s3,
  scheme: System.get_env("S3_SCHEME", "http://"),
  host:   System.get_env("S3_HOST", "localhost"),
  port:   System.get_env("S3_PORT", "9000") |> String.to_integer()

config :chatforge, :s3,
  bucket:     System.get_env("S3_BUCKET", "chatforge-avatars"),
  public_url: System.get_env("S3_PUBLIC_URL", "http://localhost:9000")

# Конфигурация OpenAI API
# В production OPENAI_API_KEY обязателен — приложение не запустится без него
openai_api_key =
  if config_env() == :prod do
    System.fetch_env!("OPENAI_API_KEY")
  else
    System.get_env("OPENAI_API_KEY", "sk-dev-placeholder")
  end

config :chatforge,
  openai_api_key: openai_api_key,
  ai_model:       System.get_env("AI_MODEL", "gpt-4o-mini"),
  ai_base_url:    System.get_env("AI_BASE_URL", "https://api.openai.com/v1")

# Публичный URL чат-инстансов (для формирования ссылок)
config :chatforge,
  chat_base_url: System.get_env("CHAT_BASE_URL", "http://localhost:5173")
