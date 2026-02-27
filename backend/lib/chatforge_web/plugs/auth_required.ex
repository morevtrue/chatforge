defmodule ChatForgeWeb.Plugs.AuthRequired do
  @moduledoc """
  Plug для защиты маршрутов — проверяет Bearer-токен.

  При валидном токене: загружает пользователя и кладёт в `conn.assigns.current_user`.
  При отсутствии или невалидном токене: останавливает pipeline с HTTP 401.
  """

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  def init(opts), do: opts

  def call(conn, _opts) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         {:ok, claims} <- ChatForge.Guardian.decode_and_verify(token, %{"typ" => "access"}),
         {:ok, user} <- ChatForge.Guardian.resource_from_claims(claims) do
      assign(conn, :current_user, user)
    else
      _ -> unauthorized(conn)
    end
  end

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{error: "unauthorized"})
    |> halt()
  end
end
