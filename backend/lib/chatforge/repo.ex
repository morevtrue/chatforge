defmodule ChatForge.Repo do
  @moduledoc """
  Ecto Repo — слой доступа к PostgreSQL.
  Все запросы к БД проходят через этот модуль.
  """

  use Ecto.Repo,
    otp_app: :chatforge,
    adapter: Ecto.Adapters.Postgres
end
