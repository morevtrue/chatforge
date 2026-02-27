defmodule ChatForgeWeb do
  @moduledoc """
  Точка входа для веб-слоя ChatForge.
  Определяет хелперы для контроллеров, роутера и других веб-модулей.
  """

  def controller do
    quote do
      use Phoenix.Controller,
        formats: [:json],
        layouts: []

      import Plug.Conn
    end
  end

  def router do
    quote do
      use Phoenix.Router, helpers: false

      import Plug.Conn
      import Phoenix.Controller
    end
  end

  # Макрос для подключения нужных модулей
  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
