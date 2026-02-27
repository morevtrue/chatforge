defmodule ChatForge.Release do
  @moduledoc """
  Задачи для запуска из Elixir release (без Mix).
  Используется в docker-compose для миграций и seeds при старте.

  Запуск:
    bin/chatforge eval "ChatForge.Release.migrate()"
    bin/chatforge eval "ChatForge.Release.seed()"
  """

  @app :chatforge

  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  def seed do
    load_app()

    seed_file = Application.app_dir(@app, "priv/repo/seeds.exs")

    if File.exists?(seed_file) do
      for repo <- repos() do
        Ecto.Migrator.with_repo(repo, fn _repo ->
          Code.eval_file(seed_file)
        end)
      end
    else
      IO.puts("Seeds file not found: #{seed_file}")
    end
  end

  defp repos do
    Application.fetch_env!(@app, :ecto_repos)
  end

  defp load_app do
    Application.load(@app)
  end
end
