defmodule ChatForgeWeb.ConnCase do
  @moduledoc """
  Вспомогательный модуль для тестов контроллеров.
  Настраивает подключение к БД через Sandbox.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      use Phoenix.ConnTest

      import ChatForgeWeb.ConnCase

      # Базовый URL для тестовых запросов
      @endpoint ChatForgeWeb.Endpoint
    end
  end

  setup tags do
    pid = Ecto.Adapters.SQL.Sandbox.start_owner!(ChatForge.Repo, shared: not tags[:async])
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end
end
