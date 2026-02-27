# Seeds для dev-окружения
# Запуск: mix run priv/repo/seeds.exs
#
# Создаёт super_admin если его ещё нет.
# Email/пароль можно переопределить через env:
#   SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=Secret123! mix run priv/repo/seeds.exs

alias ChatForge.Repo
alias ChatForge.Accounts.User
import Ecto.Query

email    = System.get_env("SEED_ADMIN_EMAIL",    "admin@chatforge.dev")
password = System.get_env("SEED_ADMIN_PASSWORD", "Admin1234!")

case Repo.one(from u in User, where: u.email == ^email) do
  nil ->
    {:ok, user} =
      %User{}
      |> User.registration_changeset(%{email: email, password: password, name: "Super Admin"})
      |> Ecto.Changeset.put_change(:role, "super_admin")
      |> Repo.insert()

    IO.puts("✅ Super Admin создан: #{user.email} / #{password}")

  %User{role: "super_admin"} = user ->
    IO.puts("ℹ️  Super Admin уже существует: #{user.email}")

  user ->
    user
    |> Ecto.Changeset.change(role: "super_admin")
    |> Repo.update!()
    IO.puts("✅ Роль обновлена до super_admin: #{user.email}")
end
