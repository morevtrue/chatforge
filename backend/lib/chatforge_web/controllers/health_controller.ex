defmodule ChatForgeWeb.HealthController do
  @moduledoc """
  Health-check эндпоинт — проверка работоспособности сервиса.
  """

  use ChatForgeWeb, :controller

  @doc """
  GET /health — возвращает статус сервиса и текущее время в ISO8601.
  """
  def index(conn, _params) do
    json(conn, %{
      status: "ok",
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end
end
