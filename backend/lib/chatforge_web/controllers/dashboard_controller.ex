defmodule ChatForgeWeb.DashboardController do
  @moduledoc """
  Контроллер API управления инстансом Creator-а.

  Маршруты:
  - GET  /api/v1/dashboard/instance          — получить инстанс + settings
  - PUT  /api/v1/dashboard/instance/settings — обновить настройки
  - POST /api/v1/dashboard/instance/avatar   — обновить аватар
  """

  use ChatForgeWeb, :controller

  alias ChatForge.Instances
  alias ChatForge.Instances.S3Adapter

  # Допустимые MIME-типы для аватара
  @allowed_mime_types ["image/jpeg", "image/png", "image/webp"]
  # Максимальный размер файла: 5 МБ
  @max_file_size 5 * 1024 * 1024

  @doc """
  GET /api/v1/dashboard/instances
  Возвращает все инстансы Creator-а.
  """
  def index(conn, _params) do
    creator_id = conn.assigns.current_user.id
    instances = Instances.get_instances_by_creator(creator_id)

    conn
    |> put_status(:ok)
    |> json(%{chat_instances: Enum.map(instances, &instance_json/1)})
  end

  @doc """
  GET /api/v1/dashboard/instance
  Возвращает первый инстанс Creator-а (legacy).
  HTTP 200 или HTTP 404 если инстанс не создан.
  """
  def show(conn, _params) do
    creator_id = conn.assigns.current_user.id

    case Instances.get_instance_by_creator(creator_id) do
      {:ok, instance} ->
        conn
        |> put_status(:ok)
        |> json(%{chat_instance: instance_json(instance)})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})
    end
  end

  @doc """
  GET /api/v1/dashboard/instances/:instance_id
  Возвращает конкретный инстанс Creator-а по id.
  HTTP 200 или HTTP 404.
  """
  def show_by_id(conn, %{"instance_id" => instance_id}) do
    creator_id = conn.assigns.current_user.id

    case get_owned_instance(creator_id, instance_id) do
      {:ok, instance} ->
        conn
        |> put_status(:ok)
        |> json(%{chat_instance: instance_json(instance)})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})
    end
  end

  @doc """
  PUT /api/v1/dashboard/instance/settings
  Обновляет настройки первого инстанса (legacy).
  """
  def update_settings(conn, params) do
    creator_id = conn.assigns.current_user.id

    case Instances.get_instance_by_creator(creator_id) do
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:ok, instance} ->
        do_update_settings(conn, instance, params, creator_id)
    end
  end

  @doc """
  PUT /api/v1/dashboard/instances/:instance_id/settings
  Обновляет настройки конкретного инстанса Creator-а.
  """
  def update_settings_by_id(conn, %{"instance_id" => instance_id} = params) do
    creator_id = conn.assigns.current_user.id
    clean_params = Map.drop(params, ["instance_id"])

    case get_owned_instance(creator_id, instance_id) do
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:ok, instance} ->
        do_update_settings(conn, instance, clean_params, creator_id)
    end
  end

  @doc """
  POST /api/v1/dashboard/instance/avatar
  Загружает аватар для первого инстанса (legacy).
  """
  def upload_avatar(conn, %{"avatar" => %Plug.Upload{} = upload} = _params) do
    creator_id = conn.assigns.current_user.id

    case Instances.get_instance_by_creator(creator_id) do
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:ok, instance} ->
        do_upload_avatar(conn, instance, upload)
    end
  end

  def upload_avatar(conn, _params) do
    conn |> put_status(:unprocessable_entity) |> json(%{error: "avatar file is required"})
  end

  @doc """
  POST /api/v1/dashboard/instances/:instance_id/avatar
  Загружает аватар для конкретного инстанса Creator-а.
  """
  def upload_avatar_by_id(conn, %{"instance_id" => instance_id, "avatar" => %Plug.Upload{} = upload}) do
    creator_id = conn.assigns.current_user.id

    case get_owned_instance(creator_id, instance_id) do
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:ok, instance} ->
        do_upload_avatar(conn, instance, upload)
    end
  end

  def upload_avatar_by_id(conn, _params) do
    conn |> put_status(:unprocessable_entity) |> json(%{error: "avatar file is required"})
  end

  # -------------------------------------------------------------------------
  # Приватные вспомогательные функции
  # -------------------------------------------------------------------------

  # Получает инстанс по id и проверяет принадлежность Creator-у
  defp get_owned_instance(creator_id, instance_id) do
    case Instances.get_instance(instance_id) do
      nil -> {:error, :not_found}
      instance ->
        if to_string(instance.creator_id) == to_string(creator_id) do
          {:ok, instance}
        else
          {:error, :not_found}
        end
    end
  end

  # Общая логика обновления настроек инстанса
  defp do_update_settings(conn, instance, params, _creator_id) do
    instance_result =
      if Map.has_key?(params, "free_messages_limit") do
        Instances.update_instance(instance, %{free_messages_limit: params["free_messages_limit"]})
      else
        {:ok, instance}
      end

    settings_params = Map.drop(params, ["free_messages_limit"])
    settings_result =
      if map_size(settings_params) > 0 do
        Instances.update_settings(instance.id, settings_params)
      else
        {:ok, nil}
      end

    case {instance_result, settings_result} do
      {{:ok, _}, {:ok, _}} ->
        {:ok, updated_instance} = Instances.get_instance(instance.id)
        conn
        |> put_status(:ok)
        |> json(%{chat_instance: instance_json(updated_instance)})

      {{:error, changeset}, _} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})

      {_, {:error, changeset}} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: format_errors(changeset)})
    end
  end

  # Общая логика загрузки аватара
  defp do_upload_avatar(conn, instance, upload) do
    size = File.stat!(upload.path).size

    cond do
      upload.content_type not in @allowed_mime_types ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid_file_type"})

      size > @max_file_size ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "file_too_large"})

      true ->
        ext = Path.extname(upload.filename)
        key = "avatars/#{instance.id}/#{Ecto.UUID.generate()}#{ext}"

        case S3Adapter.upload(key, upload.path, upload.content_type) do
          {:ok, url} ->
            Instances.update_settings(instance.id, %{avatar_url: url})
            conn |> put_status(:ok) |> json(%{avatar_url: url})

          {:error, _reason} ->
            conn |> put_status(:internal_server_error) |> json(%{error: "upload_failed"})
        end
    end
  end

  # Сериализует ChatInstance с настройками в JSON-совместимый формат
  defp instance_json(instance) do
    settings = instance.instance_settings
    base_url = System.get_env("CHAT_BASE_URL", "http://localhost:5173/chat")

    %{
      id: instance.id,
      name: instance.name,
      subdomain: instance.subdomain,
      currency: instance.currency,
      status: instance.status,
      free_messages_limit: instance.free_messages_limit,
      public_url: "#{base_url}?subdomain=#{instance.subdomain}",
      settings: if(settings, do: settings_json(settings), else: nil)
    }
  end

  # Сериализует InstanceSettings в JSON-совместимый формат
  defp settings_json(settings) do
    %{
      id: settings.id,
      primary_color: settings.primary_color,
      secondary_color: settings.secondary_color,
      background_color: settings.background_color,
      avatar_url: settings.avatar_url,
      greeting_text: settings.greeting_text,
      example_questions: settings.example_questions,
      system_prompt: settings.system_prompt
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
