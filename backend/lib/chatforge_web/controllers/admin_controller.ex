defmodule ChatForgeWeb.AdminController do
  @moduledoc """
  Контроллер Admin API — управление платформой ChatForge.
  Все маршруты защищены pipeline :admin (AuthRequired + RequireSuperAdmin).

  Маршруты:
  - GET  /api/v1/admin/stats
  - GET  /api/v1/admin/creators
  - GET  /api/v1/admin/creators/:id
  - PUT  /api/v1/admin/creators/:id/suspend
  - PUT  /api/v1/admin/creators/:id/activate
  - GET  /api/v1/admin/instances
  - PUT  /api/v1/admin/instances/:id/suspend
  - PUT  /api/v1/admin/instances/:id/activate
  - GET  /api/v1/admin/ai-usage
  """

  use ChatForgeWeb, :controller

  alias ChatForge.Admin

  # -------------------------------------------------------------------------
  # Статистика платформы
  # -------------------------------------------------------------------------

  @doc "GET /api/v1/admin/stats"
  def stats(conn, _params) do
    stats = Admin.get_platform_stats()

    conn
    |> put_status(:ok)
    |> json(%{
      stats: %{
        total_creators: stats.total_creators,
        active_instances: stats.active_instances,
        total_messages: stats.total_messages,
        total_revenue: Decimal.to_string(stats.total_revenue)
      }
    })
  end

  # -------------------------------------------------------------------------
  # Creator-ы
  # -------------------------------------------------------------------------

  @doc "GET /api/v1/admin/creators?page=1&search=email&status=active"
  def list_creators(conn, params) do
    opts = %{
      page:   parse_page(params["page"]),
      search: params["search"],
      status: params["status"]
    }

    result = Admin.list_creators(opts)

    conn
    |> put_status(:ok)
    |> json(%{
      creators: Enum.map(result.creators, &creator_with_count_json/1),
      total:    result.total,
      page:     result.page,
      per_page: result.per_page
    })
  end

  @doc "GET /api/v1/admin/creators/:id"
  def get_creator(conn, %{"id" => id}) do
    case Admin.get_creator_with_instances(id) do
      {:ok, %{creator: creator, instances: instances}} ->
        conn
        |> put_status(:ok)
        |> json(%{
          creator:   creator_json(creator),
          instances: Enum.map(instances, &instance_json/1)
        })

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})
    end
  end

  @doc "PUT /api/v1/admin/creators/:id/suspend"
  def suspend_creator(conn, %{"id" => id}) do
    admin = conn.assigns.current_user

    case Admin.suspend_creator(admin, id) do
      {:ok, creator} ->
        conn
        |> put_status(:ok)
        |> json(%{creator: creator_json(creator)})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})

      {:error, :cannot_suspend_self} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "cannot_suspend_self"})
    end
  end

  @doc "PUT /api/v1/admin/creators/:id/activate"
  def activate_creator(conn, %{"id" => id}) do
    admin = conn.assigns.current_user

    case Admin.activate_creator(admin, id) do
      {:ok, creator} ->
        conn
        |> put_status(:ok)
        |> json(%{creator: creator_json(creator)})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})
    end
  end

  # -------------------------------------------------------------------------
  # Инстансы
  # -------------------------------------------------------------------------

  @doc "GET /api/v1/admin/instances?page=1&status=active"
  def list_instances(conn, params) do
    opts = %{
      page:   parse_page(params["page"]),
      status: params["status"]
    }

    result = Admin.list_instances(opts)

    conn
    |> put_status(:ok)
    |> json(%{
      instances: Enum.map(result.instances, &instance_with_count_json/1),
      total:     result.total,
      page:      result.page,
      per_page:  result.per_page
    })
  end

  @doc "PUT /api/v1/admin/instances/:id/suspend"
  def suspend_instance(conn, %{"id" => id}) do
    admin = conn.assigns.current_user

    case Admin.suspend_instance(admin, id) do
      {:ok, instance} ->
        conn
        |> put_status(:ok)
        |> json(%{instance: instance_json(instance)})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})
    end
  end

  @doc "PUT /api/v1/admin/instances/:id/activate"
  def activate_instance(conn, %{"id" => id}) do
    admin = conn.assigns.current_user

    case Admin.activate_instance(admin, id) do
      {:ok, instance} ->
        conn
        |> put_status(:ok)
        |> json(%{instance: instance_json(instance)})

      {:error, :not_found} ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "not_found"})
    end
  end

  # -------------------------------------------------------------------------
  # AI Usage
  # -------------------------------------------------------------------------

  @doc "GET /api/v1/admin/ai-usage?period=7d|30d"
  def ai_usage(conn, params) do
    period = params["period"] || "7d"

    case period do
      p when p in ["7d", "30d"] ->
        usage = Admin.get_ai_usage(p)

        conn
        |> put_status(:ok)
        |> json(%{
          period: p,
          total_input_tokens:  usage.total_input_tokens,
          total_output_tokens: usage.total_output_tokens,
          total_cost:          Decimal.to_string(usage.total_cost),
          by_instance: Enum.map(usage.by_instance, fn item ->
            %{
              instance_id:   item.instance_id,
              instance_name: item.instance_name,
              input_tokens:  item.input_tokens,
              output_tokens: item.output_tokens,
              cost:          Decimal.to_string(item.cost || Decimal.new(0))
            }
          end)
        })

      _ ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{error: "invalid period, use 7d or 30d"})
    end
  end

  # -------------------------------------------------------------------------
  # Приватные вспомогательные функции
  # -------------------------------------------------------------------------

  defp creator_json(user) do
    %{
      id:           user.id,
      email:        user.email,
      name:         user.name,
      role:         user.role,
      status:       user.status,
      inserted_at:  user.inserted_at
    }
  end

  # Для list_creators — включает instances_count
  defp creator_with_count_json(%{creator: user, instances_count: count}) do
    creator_json(user)
    |> Map.put(:instances_count, count)
  end

  defp instance_json(instance) do
    creator_email =
      case instance do
        %{creator: %{email: email}} -> email
        _ -> nil
      end

    %{
      id:          instance.id,
      name:        instance.name,
      subdomain:   instance.subdomain,
      status:      instance.status,
      currency:    instance.currency,
      creator_id:  instance.creator_id,
      creator_email: creator_email,
      inserted_at: instance.inserted_at
    }
  end

  # Для list_instances — включает end_users_count
  defp instance_with_count_json(%{instance: inst, end_users_count: count}) do
    instance_json(inst)
    |> Map.put(:end_users_count, count)
  end

  defp parse_page(nil), do: 1
  defp parse_page(p) when is_binary(p) do
    case Integer.parse(p) do
      {n, _} when n > 0 -> n
      _ -> 1
    end
  end
  defp parse_page(p) when is_integer(p) and p > 0, do: p
  defp parse_page(_), do: 1
end
