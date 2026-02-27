defmodule ChatForgeWeb.Endpoint do
  @moduledoc """
  Phoenix Endpoint — точка входа для всех HTTP-запросов.
  """

  use Phoenix.Endpoint, otp_app: :chatforge

  # WebSocket для AI-чата (End User)
  socket "/socket", ChatForgeWeb.UserSocket,
    websocket: true,
    longpoll: false

  # Уникальный идентификатор запроса для логирования
  plug Plug.RequestId

  # Телеметрия для метрик
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  # Парсинг JSON-тела запроса
  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()

  # Декодирование сессии (нужно для Phoenix)
  plug Plug.MethodOverride
  plug Plug.Head

  # Роутер — обрабатывает все маршруты
  plug ChatForgeWeb.Router
end
