defmodule ChatForgeWeb.UserSocket do
  @moduledoc """
  Phoenix UserSocket — точка входа для WebSocket-соединений.
  Аутентификация End User-а происходит при подключении через параметр token.
  """

  use Phoenix.Socket

  require Logger

  # Регистрируем канал чата
  channel "chat:*", ChatForgeWeb.ChatChannel

  @doc """
  Подключение к сокету.
  Верифицирует Bearer-токен End User-а из параметров подключения.
  При успехе кладёт end_user и tenant_id в assigns сокета.
  """
  def connect(%{"token" => token}, socket, _connect_info) do
    case ChatForge.Guardian.decode_and_verify(token, %{"typ" => "access"}) do
      {:ok, claims} ->
        case ChatForge.Guardian.resource_from_claims(claims) do
          {:ok, end_user} ->
            socket =
              socket
              |> assign(:current_user, end_user)
              |> assign(:tenant_id, end_user.chat_instance_id)

            {:ok, socket}

          {:error, reason} ->
            Logger.warning("UserSocket: resource_from_claims failed: #{inspect(reason)}, claims: #{inspect(claims)}")
            :error
        end

      {:error, reason} ->
        Logger.warning("UserSocket: decode_and_verify failed: #{inspect(reason)}")
        :error
    end
  end

  def connect(_params, _socket, _connect_info), do: :error

  def id(socket), do: "user_socket:#{socket.assigns.current_user.id}"
end
