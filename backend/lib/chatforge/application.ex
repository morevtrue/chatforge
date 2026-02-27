defmodule ChatForge.Application do
  @moduledoc """
  OTP Application — точка входа в приложение ChatForge.
  Запускает дерево супервизоров.
  """

  use Application

  @impl true
  def start(_type, _args) do
    redis_url = Application.get_env(:chatforge, :redis_url, "redis://localhost:6379")

    children = [
      # Подключение к PostgreSQL через Ecto
      ChatForge.Repo,

      # Подключение к Redis через Redix
      {Redix, {redis_url, [name: :redix]}},

      # PubSub для внутренней коммуникации
      {Phoenix.PubSub, name: ChatForge.PubSub},

      # Phoenix Endpoint — HTTP-сервер
      ChatForgeWeb.Endpoint,

      # Analytics EventHandler — слушает PubSub и записывает события
      ChatForge.Analytics.EventHandler
    ]

    opts = [strategy: :one_for_one, name: ChatForge.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Вызывается при горячем обновлении кода
  @impl true
  def config_change(changed, _new, removed) do
    ChatForgeWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
