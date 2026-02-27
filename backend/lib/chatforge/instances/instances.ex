defmodule ChatForge.Instances do
  @moduledoc "Publichnyy API konteksta Instances."

  alias ChatForge.Instances.{ChatInstance, InstanceSettings, WizardState, S3Adapter}
  alias ChatForge.Repo

  # --- ChatInstance ---

  def create_instance(creator_id, attrs) do
    %ChatInstance{}
    |> ChatInstance.changeset(Map.put(attrs, :creator_id, creator_id))
    |> Repo.insert()
  end

  @doc """
  Возвращает инстанс по id с предзагруженными настройками, или nil.
  """
  def get_instance(id) do
    case Repo.get(ChatInstance, id) do
      nil -> nil
      instance -> Repo.preload(instance, :instance_settings)
    end
  end

  def get_instance_by_subdomain(subdomain) do
    case Repo.get_by(ChatInstance, subdomain: subdomain) do
      nil -> {:error, :not_found}
      instance -> {:ok, instance}
    end
  end

  def get_instance_by_creator(creator_id) do
    import Ecto.Query
    case Repo.one(from c in ChatInstance, where: c.creator_id == ^creator_id, order_by: [desc: c.inserted_at], limit: 1) do
      nil -> {:error, :not_found}
      instance -> {:ok, Repo.preload(instance, :instance_settings)}
    end
  end

  def get_instances_by_creator(creator_id) do
    import Ecto.Query
    ChatInstance
    |> where([c], c.creator_id == ^creator_id)
    |> order_by([c], desc: c.inserted_at)
    |> Repo.all()
    |> Repo.preload(:instance_settings)
  end

  def validate_subdomain(subdomain) do
    cond do
      not String.match?(subdomain, ~r/^[a-z0-9-]+$/) ->
        {:error, :invalid_format}
      Repo.get_by(ChatInstance, subdomain: subdomain) != nil ->
        {:error, :taken}
      true ->
        {:ok, :available}
    end
  end

  # --- InstanceSettings ---

  @doc """
  Обновляет поля самого ChatInstance (например, free_messages_limit).
  """
  def update_instance(instance, attrs) do
    instance
    |> ChatInstance.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Приостанавливает все инстансы Creator-а: устанавливает status = "suspended".
  Возвращает количество обновлённых записей.
  """
  def suspend_instances_by_creator(creator_id) do
    import Ecto.Query

    {count, _} =
      from(c in ChatInstance, where: c.creator_id == ^creator_id)
      |> Repo.update_all(set: [status: "suspended"])

    count
  end

  def update_settings(chat_instance_id, attrs) do
    case Repo.get_by(InstanceSettings, chat_instance_id: chat_instance_id) do
      nil ->
        %InstanceSettings{}
        |> InstanceSettings.changeset(Map.put(attrs, :chat_instance_id, chat_instance_id))
        |> Repo.insert()
      settings ->
        settings
        |> InstanceSettings.changeset(attrs)
        |> Repo.update()
    end
  end

  # --- WizardState ---

  def get_or_create_wizard_state(creator_id) do
    %WizardState{}
    |> WizardState.changeset(%{creator_id: creator_id})
    |> Repo.insert(on_conflict: :nothing, conflict_target: :creator_id)
    |> case do
      {:ok, %WizardState{id: nil}} ->
        # on_conflict: :nothing не возвращает строку — читаем существующую
        {:ok, Repo.get_by!(WizardState, creator_id: creator_id)}
      {:ok, wizard_state} ->
        {:ok, wizard_state}
      {:error, changeset} ->
        {:error, changeset}
    end
  end

  def get_wizard_state(creator_id) do
    case Repo.get_by(WizardState, creator_id: creator_id) do
      nil -> {:error, :not_found}
      wizard_state -> {:ok, wizard_state}
    end
  end

  def update_wizard_step(creator_id, step, draft_attrs) do
    case Repo.get_by(WizardState, creator_id: creator_id) do
      nil ->
        {:error, :not_found}
      wizard_state ->
        current_draft = wizard_state.draft_settings || %{}
        merged_draft = Map.merge(current_draft, draft_attrs)
        # Переходим на следующий шаг (step — текущий, сохраняем step+1 если не последний)
        next_step = if step && step < 4, do: step + 1, else: step
        attrs = if next_step, do: %{current_step: next_step, draft_settings: merged_draft}, else: %{draft_settings: merged_draft}
        wizard_state
        |> WizardState.changeset(attrs)
        |> Repo.update()
    end
  end

  @doc """
  Обновляет только draft_settings визарда без изменения current_step.
  Используется для сохранения данных (например, avatar_url) вне шагов.
  """
  def update_wizard_draft(creator_id, draft_attrs) do
    case Repo.get_by(WizardState, creator_id: creator_id) do
      nil ->
        {:error, :not_found}
      wizard_state ->
        current_draft = wizard_state.draft_settings || %{}
        merged_draft = Map.merge(current_draft, draft_attrs)
        wizard_state
        |> WizardState.changeset(%{draft_settings: merged_draft})
        |> Repo.update()
    end
  end

  def finalize_wizard(creator_id) do
    case Repo.get_by(WizardState, creator_id: creator_id) do
      nil ->
        {:error, :incomplete_wizard}
      wizard_state ->
        draft = wizard_state.draft_settings || %{}
        required = ["name", "subdomain", "currency"]
        if Enum.any?(required, &(not Map.has_key?(draft, &1) or draft[&1] == nil)) do
          {:error, :incomplete_wizard}
        else
          multi_result =
            Ecto.Multi.new()
            |> Ecto.Multi.insert(:instance, fn _ ->
              %ChatInstance{}
              |> ChatInstance.changeset(%{
                creator_id: creator_id,
                name: draft["name"],
                subdomain: draft["subdomain"],
                currency: draft["currency"],
                status: "active",
                free_messages_limit: draft["free_messages_limit"]
              })
            end)
            |> Ecto.Multi.insert(:settings, fn %{instance: instance} ->
              %InstanceSettings{}
              |> InstanceSettings.changeset(%{
                chat_instance_id: instance.id,
                primary_color: draft["primary_color"],
                secondary_color: draft["secondary_color"],
                background_color: draft["background_color"],
                avatar_url: draft["avatar_url"],
                greeting_text: draft["greeting_text"],
                example_questions: draft["example_questions"] || []
              })
            end)
            |> Ecto.Multi.delete(:wizard_state, wizard_state)
            |> Repo.transaction()
          case multi_result do
            {:ok, %{instance: instance}} ->
              Phoenix.PubSub.broadcast(ChatForge.PubSub, "instances", {:instance_created, instance})
              {:ok, instance}
            {:error, _op, changeset, _changes} ->
              {:error, changeset}
          end
        end
    end
  end

  # --- Avatar ---

  # Допустимые MIME-типы для аватара
  @allowed_mime_types ["image/jpeg", "image/png", "image/webp"]
  # Максимальный размер файла: 5 МБ
  @max_file_size_bytes 5 * 1024 * 1024

  def upload_avatar(chat_instance_id, %{path: path, content_type: content_type, size: size}) do
    cond do
      content_type not in @allowed_mime_types ->
        {:error, :invalid_file_type}

      size > @max_file_size_bytes ->
        {:error, :file_too_large}

      true ->
        # Генерируем уникальный ключ для файла
        ext = content_type_to_ext(content_type)
        key = "avatars/#{chat_instance_id}/#{Ecto.UUID.generate()}#{ext}"

        case S3Adapter.upload(key, path, content_type) do
          {:ok, url} ->
            # Обновляем avatar_url в InstanceSettings
            update_settings(chat_instance_id, %{avatar_url: url})
            {:ok, url}

          {:error, reason} ->
            {:error, reason}
        end
    end
  end

  defp content_type_to_ext("image/jpeg"), do: ".jpg"
  defp content_type_to_ext("image/png"), do: ".png"
  defp content_type_to_ext("image/webp"), do: ".webp"
  defp content_type_to_ext(_), do: ""
end
