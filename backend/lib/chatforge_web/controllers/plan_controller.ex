defmodule ChatForgeWeb.PlanController do
  @moduledoc """
  Контроллер API управления тарифными планами Creator-а.

  Маршруты:
  - GET    /api/v1/dashboard/plans     — список планов инстанса
  - POST   /api/v1/dashboard/plans     — создать план
  - PUT    /api/v1/dashboard/plans/:id — обновить план
  - DELETE /api/v1/dashboard/plans/:id — деактивировать план
  """

  use ChatForgeWeb, :controller

  alias ChatForge.Billing
  alias ChatForge.Instances

  @doc """
  GET /api/v1/dashboard/plans
  Возвращает все тарифные планы первого инстанса Creator-а (legacy).
  HTTP 200 или HTTP 404 если инстанс не найден.
  """
  def index(conn, _params) do
    creator_id = conn.assigns.current_user.id

    case Instances.get_instance_by_creator(creator_id) do
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})

      {:ok, instance} ->
        plans = Billing.list_plans(instance.id)

        conn
        |> put_status(:ok)
        |> json(%{plans: Enum.map(plans, &plan_json/1)})
    end
  end

  @doc """
  GET /api/v1/dashboard/instances/:instance_id/plans
  Возвращает все тарифные планы конкретного инстанса Creator-а.
  """
  def index_by_instance(conn, %{"instance_id" => instance_id}) do
    creator_id = conn.assigns.current_user.id

    case get_owned_instance(creator_id, instance_id) do
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:ok, instance} ->
        plans = Billing.list_plans(instance.id)
        conn |> put_status(:ok) |> json(%{plans: Enum.map(plans, &plan_json/1)})
    end
  end

  @doc """
  POST /api/v1/dashboard/plans
  Создаёт новый тарифный план для первого инстанса Creator-а (legacy).
  HTTP 201 с созданным планом или HTTP 422 при ошибке валидации.
  """
  def create(conn, params) do
    creator_id = conn.assigns.current_user.id

    case Instances.get_instance_by_creator(creator_id) do
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:ok, instance} ->
        do_create_plan(conn, instance, params)
    end
  end

  @doc """
  POST /api/v1/dashboard/instances/:instance_id/plans
  Создаёт тарифный план для конкретного инстанса Creator-а.
  """
  def create_by_instance(conn, %{"instance_id" => instance_id} = params) do
    creator_id = conn.assigns.current_user.id
    clean_params = Map.drop(params, ["instance_id"])

    case get_owned_instance(creator_id, instance_id) do
      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "not_found"})

      {:ok, instance} ->
        do_create_plan(conn, instance, clean_params)
    end
  end

  @doc """
  PUT /api/v1/dashboard/plans/:id
  Обновляет тарифный план.
  Проверяет что план принадлежит инстансу Creator-а.
  HTTP 200, HTTP 404 или HTTP 422.
  """
  def update(conn, %{"id" => plan_id} = params) do
    creator_id = conn.assigns.current_user.id

    case Instances.get_instance_by_creator(creator_id) do
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})

      {:ok, instance} ->
        # Атрибуты плана берём из вложенного ключа "plan" или из корня params
        plan_attrs = Map.get(params, "plan", Map.drop(params, ["id"]))

        # Сначала проверяем существование плана и принадлежность тенанту ДО обновления
        case ChatForge.Repo.get(ChatForge.Billing.SubscriptionPlan, plan_id) do
          nil ->
            conn
            |> put_status(:not_found)
            |> json(%{error: "not_found"})

          plan when plan.chat_instance_id != instance.id ->
            conn
            |> put_status(:not_found)
            |> json(%{error: "not_found"})

          _plan ->
            case Billing.update_plan(plan_id, plan_attrs) do
              {:ok, updated_plan} ->
                conn
                |> put_status(:ok)
                |> json(%{plan: plan_json(updated_plan)})

              {:error, :not_found} ->
                conn
                |> put_status(:not_found)
                |> json(%{error: "not_found"})

              {:error, changeset} ->
                conn
                |> put_status(:unprocessable_entity)
                |> json(%{errors: format_errors(changeset)})
            end
        end
    end
  end

  @doc """
  DELETE /api/v1/dashboard/plans/:id
  Деактивирует тарифный план (is_active: false).
  Проверяет что план принадлежит инстансу Creator-а.
  HTTP 200 `%{ok: true}` или HTTP 404.
  """
  def delete(conn, %{"id" => plan_id}) do
    creator_id = conn.assigns.current_user.id

    case Instances.get_instance_by_creator(creator_id) do
      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})

      {:ok, instance} ->
        # Сначала проверяем существование плана и принадлежность тенанту
        case ChatForge.Repo.get(ChatForge.Billing.SubscriptionPlan, plan_id) do
          nil ->
            conn
            |> put_status(:not_found)
            |> json(%{error: "not_found"})

          plan ->
            if to_string(plan.chat_instance_id) != to_string(instance.id) do
              conn
              |> put_status(:not_found)
              |> json(%{error: "not_found"})
            else
              case Billing.deactivate_plan(plan_id) do
                {:ok, _plan} ->
                  conn
                  |> put_status(:ok)
                  |> json(%{ok: true})

                {:error, :not_found} ->
                  conn
                  |> put_status(:not_found)
                  |> json(%{error: "not_found"})
              end
            end
        end
    end
  end

  # -------------------------------------------------------------------------
  # Приватные вспомогательные функции
  # -------------------------------------------------------------------------

  # Проверяет принадлежность инстанса Creator-у
  defp get_owned_instance(creator_id, instance_id) do
    case Instances.get_instance(instance_id) do
      nil -> {:error, :not_found}
      instance ->
        if to_string(instance.creator_id) == to_string(creator_id),
          do: {:ok, instance},
          else: {:error, :not_found}
    end
  end

  # Общая логика создания плана
  defp do_create_plan(conn, instance, params) do
    plan_attrs = Map.get(params, "plan", params)

    case Billing.create_plan(plan_attrs, instance.id) do
      {:ok, plan} ->
        conn |> put_status(:created) |> json(%{plan: plan_json(plan)})

      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
    end
  end

  # Сериализует SubscriptionPlan в JSON-совместимый формат
  defp plan_json(plan) do
    %{
      id:            plan.id,
      name:          plan.name,
      price:         plan.price,
      period:        plan.period,
      message_limit: plan.message_limit,
      is_active:     plan.is_active,
      inserted_at:   plan.inserted_at
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
