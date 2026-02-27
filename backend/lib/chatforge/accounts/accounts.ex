defmodule ChatForge.Accounts do
  @moduledoc """
  Контекст Accounts: регистрация, аутентификация, профили Creator-ов платформы.

  Зона ответственности:
  - Регистрация и вход Creator-ов
  - Управление профилями пользователей платформы
  - Хеширование паролей

  Не обращается к схемам других контекстов напрямую.
  """

  alias ChatForge.Repo
  alias ChatForge.Accounts.User

  @doc """
  Регистрирует нового Creator-а.
  Возвращает `{:ok, user}` или `{:error, changeset}`.
  """
  def register_creator(attrs) do
    %User{}
    |> User.registration_changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Аутентифицирует Creator-а по email и паролю.
  Возвращает `{:ok, user}` или `{:error, :invalid_credentials}`.
  Оба случая ошибки (несуществующий email и неверный пароль) возвращают
  одинаковый ответ — защита от user enumeration.
  """
  def authenticate(email, password) do
    user = get_user_by_email(email)

    cond do
      user && user.status == "suspended" ->
        # Пользователь заблокирован — выполняем dummy-проверку для защиты от timing attacks
        Bcrypt.no_user_verify()
        {:error, :suspended}

      user && Bcrypt.verify_pass(password, user.password_hash) ->
        {:ok, user}

      user ->
        {:error, :invalid_credentials}

      true ->
        Bcrypt.no_user_verify()
        {:error, :invalid_credentials}
    end
  end

  @doc """
  Возвращает пользователя по id.
  Выбрасывает `Ecto.NoResultsError` если не найден.
  """
  def get_user!(id), do: Repo.get!(User, id)

  @doc """
  Возвращает пользователя по id или `nil`.
  Безопасная версия без исключений — используется в Guardian.
  """
  def get_user_by_id(id), do: Repo.get(User, id)

  @doc """
  Возвращает пользователя по email или `nil`.
  """
  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: email)
  end

  def get_user_by_email(_), do: nil

  @doc """
  Хэширует пароль через bcrypt.
  Каждый вызов возвращает уникальный хэш (bcrypt salt).
  """
  def hash_password(password) do
    Bcrypt.hash_pwd_salt(password)
  end

  @doc """
  Обновляет статус пользователя (active | suspended).
  Возвращает `{:ok, user}` или `{:error, changeset}`.
  """
  def update_user_status(user, status) do
    user
    |> User.status_changeset(%{status: status})
    |> Repo.update()
  end

  @doc """
  Возвращает список всех Creator-ов с пагинацией, поиском и фильтром по статусу.
  Используется Admin контекстом.
  """
  def list_creators(opts \\ %{}) do
    import Ecto.Query

    page     = Map.get(opts, :page, 1)
    per_page = 20
    search   = Map.get(opts, :search)
    status   = Map.get(opts, :status)

    base =
      from u in User,
        where: u.role == "creator",
        order_by: [desc: u.inserted_at]

    base = if search && search != "" do
      # Экранируем спецсимволы LIKE: %, _, \
      escaped =
        search
        |> String.downcase()
        |> String.replace("\\", "\\\\")
        |> String.replace("%", "\\%")
        |> String.replace("_", "\\_")

      pattern = "%#{escaped}%"
      from u in base, where: ilike(u.email, ^pattern)
    else
      base
    end

    base = if status && status != "all" && status != "" do
      from u in base, where: u.status == ^status
    else
      base
    end

    total = Repo.aggregate(base, :count, :id)

    creators =
      base
      |> limit(^per_page)
      |> offset(^((page - 1) * per_page))
      |> Repo.all()

    %{creators: creators, total: total, page: page, per_page: per_page}
  end
end
