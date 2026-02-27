defmodule ChatForgeWeb.BuilderController do
  @moduledoc """
  Контроллер API визарда создания чата (Builder).

  Маршруты:
  - POST /api/v1/builder/start              — создать или вернуть WizardState
  - GET  /api/v1/builder/state              — получить текущий WizardState
  - PUT  /api/v1/builder/step/:step         — сохранить данные шага
  - POST /api/v1/builder/avatar             — загрузить аватар
  - POST /api/v1/builder/finalize           — финализировать визард
  - GET  /api/v1/builder/validate-subdomain — проверить доступность поддомена
  """

  use ChatForgeWeb, :controller

  alias ChatForge.Instances
  alias ChatForge.Instances.S3Adapter

  # Допустимые MIME-типы для аватара
  @allowed_mime_types ["image/jpeg", "image/png", "image/webp"]
  # Максимальный размер файла: 5 МБ
  @max_file_size 5 * 1024 * 1024

  @doc """
  POST /api/v1/builder/start
  Идемпотентный старт визарда.
  Возвращает 201 при создании нового WizardState, 200 при существующем.
  """
  def start(conn, _params) do
    creator_id = conn.assigns.current_user.id

    # Используем контекст Instances — не обращаемся к Repo напрямую
    existing = Instances.get_wizard_state(creator_id)

    {:ok, wizard_state} = Instances.get_or_create_wizard_state(creator_id)

    status = if match?({:ok, _}, existing), do: :ok, else: :created

    conn
    |> put_status(status)
    |> json(%{wizard_state: wizard_state_json(wizard_state)})
  end

  @doc """
  GET /api/v1/builder/state
  Возвращает текущий WizardState Creator-а.
  HTTP 200 с данными или HTTP 404 если визард не начат.
  """
  def state(conn, _params) do
    creator_id = conn.assigns.current_user.id

    case Instances.get_wizard_state(creator_id) do
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})

      {:ok, wizard_state} ->
        conn
        |> put_status(:ok)
        |> json(%{wizard_state: wizard_state_json(wizard_state)})
    end
  end

  @doc """
  PUT /api/v1/builder/step/:step
  Сохраняет данные шага визарда.
  HTTP 200 с обновлённым WizardState или HTTP 422 при ошибке валидации.
  """
  def update_step(conn, %{"step" => step_str} = params) do
    creator_id = conn.assigns.current_user.id

    # Безопасная конвертация step из строки в integer (1..4)
    case Integer.parse(step_str) do
      {step, ""} when step in 1..4 ->
        # Убираем служебные параметры, оставляем только данные шага
        draft_attrs = Map.drop(params, ["step"])

        case Instances.update_wizard_step(creator_id, step, draft_attrs) do
          {:ok, wizard_state} ->
            conn
            |> put_status(:ok)
            |> json(%{wizard_state: wizard_state_json(wizard_state)})

          {:error, :not_found} ->
            conn
            |> put_status(:not_found)
            |> json(%{error: "not_found"})

          {:error, changeset} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{errors: format_errors(changeset)})
        end

      _ ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "invalid step"})
    end
  end

  @doc """
  POST /api/v1/builder/avatar
  Загружает аватар в S3 и возвращает URL.
  Работает без авторизации — используется до финализации визарда.
  HTTP 200 с avatar_url или HTTP 422 при ошибке.
  """
  def upload_avatar(conn, %{"avatar" => %Plug.Upload{} = upload}) do
    size = File.stat!(upload.path).size

    cond do
      upload.content_type not in @allowed_mime_types ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "invalid_file_type"})

      size > @max_file_size ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "file_too_large"})

      true ->
        ext = Path.extname(upload.filename)
        key = "avatars/tmp/#{Ecto.UUID.generate()}#{ext}"

        case S3Adapter.upload(key, upload.path, upload.content_type) do
          {:ok, url} ->
            conn
            |> put_status(:ok)
            |> json(%{avatar_url: url})

          {:error, _reason} ->
            conn
            |> put_status(:internal_server_error)
            |> json(%{error: "upload_failed"})
        end
    end
  end

  def upload_avatar(conn, _params) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{error: "avatar file is required"})
  end

  @doc """
  POST /api/v1/builder/finalize
  Финализирует визард: создаёт ChatInstance + InstanceSettings, удаляет WizardState.
  HTTP 201 с данными ChatInstance или HTTP 422 при ошибке.
  """
  def finalize(conn, _params) do
    creator_id = conn.assigns.current_user.id

    case Instances.finalize_wizard(creator_id) do
      {:ok, instance} ->
        conn
        |> put_status(:created)
        |> json(%{chat_instance: instance_json(instance)})

      {:error, :incomplete_wizard} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "incomplete_wizard"})

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  @doc """
  GET /api/v1/builder/validate-subdomain?subdomain=...
  Проверяет доступность поддомена.
  HTTP 200 с {available: true} или {available: false, reason: "taken"/"invalid_format"}.
  """
  def validate_subdomain(conn, %{"subdomain" => subdomain}) do
    case Instances.validate_subdomain(subdomain) do
      {:ok, :available} ->
        conn
        |> put_status(:ok)
        |> json(%{available: true})

      {:error, :taken} ->
        conn
        |> put_status(:ok)
        |> json(%{available: false, reason: "taken"})

      {:error, :invalid_format} ->
        conn
        |> put_status(:ok)
        |> json(%{available: false, reason: "invalid_format"})
    end
  end

  def validate_subdomain(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "subdomain parameter is required"})
  end

  # -------------------------------------------------------------------------
  # Приватные вспомогательные функции
  # -------------------------------------------------------------------------

  # Сериализует WizardState в JSON-совместимый формат
  defp wizard_state_json(ws) do
    %{
      id: ws.id,
      current_step: ws.current_step,
      draft_settings: ws.draft_settings
    }
  end

  # Сериализует ChatInstance в JSON-совместимый формат
  defp instance_json(instance) do
    base_url = System.get_env("CHAT_BASE_URL", "http://localhost:5173/chat")
    %{
      id: instance.id,
      name: instance.name,
      subdomain: instance.subdomain,
      currency: instance.currency,
      status: instance.status,
      free_messages_limit: instance.free_messages_limit,
      public_url: "#{base_url}?subdomain=#{instance.subdomain}"
    }
  end

  # Форматирует ошибки changeset в плоский map для JSON-ответа
  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end
end
