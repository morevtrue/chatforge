defmodule ChatForgeWeb.Plugs.RequireRole do
  @moduledoc """
  Plug для проверки роли текущего пользователя.

  Использование в роутере:
    plug ChatForgeWeb.Plugs.RequireRole, "creator"

  При совпадении роли: пропускает запрос дальше.
  При несовпадении: останавливает pipeline с HTTP 403.
  Должен использоваться после AuthRequired.
  """

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  def init(role) when is_binary(role), do: role

  def call(conn, required_role) do
    case conn.assigns[:current_user] do
      %{role: ^required_role} -> conn
      _ -> forbidden(conn)
    end
  end

  defp forbidden(conn) do
    conn
    |> put_status(:forbidden)
    |> json(%{error: "forbidden"})
    |> halt()
  end
end
