defmodule ChatForgeWeb.Plugs.RequireSuperAdmin do
  @moduledoc """
  Plug для защиты Admin-маршрутов — проверяет роль `super_admin`.

  Должен использоваться после `AuthRequired` (current_user уже загружен).
  При несоответствии роли — останавливает pipeline с HTTP 403.
  """

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  def init(opts), do: opts

  def call(conn, _opts) do
    case conn.assigns[:current_user] do
      %{role: "super_admin"} -> conn
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
