defmodule ChatForgeWeb.Router do
  @moduledoc """
  Роутер — маршрутизация HTTP-запросов.
  """

  use ChatForgeWeb, :router

  # Pipeline для JSON API
  pipeline :api do
    plug :accepts, ["json"]
    plug CORSPlug
  end

  # Pipeline для защищённых маршрутов — проверяет Bearer-токен
  pipeline :authenticated do
    plug ChatForgeWeb.Plugs.AuthRequired
  end

  # Pipeline для маршрутов чат-инстанса — резолвит тенант по поддомену
  pipeline :chat_tenant do
    plug ChatForgeWeb.Plugs.TenantResolver
  end

  # Pipeline для Admin-маршрутов — требует аутентификацию + роль super_admin
  pipeline :admin do
    plug ChatForgeWeb.Plugs.AuthRequired
    plug ChatForgeWeb.Plugs.RequireSuperAdmin
  end

  # -------------------------------------------------------------------------
  # Публичные маршруты
  # -------------------------------------------------------------------------

  scope "/", ChatForgeWeb do
    pipe_through :api

    get "/health", HealthController, :index
  end

  # Публичные маршруты Creator-а (регистрация, логин, обновление токена)
  scope "/api/v1/auth", ChatForgeWeb do
    pipe_through :api

    post "/register", AuthController, :register
    post "/login",    AuthController, :login
    post "/refresh",  AuthController, :refresh
  end

  # Защищённые маршруты Creator-а (требуют валидный Bearer-токен)
  scope "/api/v1/auth", ChatForgeWeb do
    pipe_through [:api, :authenticated]

    post "/logout", AuthController, :logout
    get  "/me",     AuthController, :me
  end

  # -------------------------------------------------------------------------
  # Маршруты визарда Builder
  # -------------------------------------------------------------------------

  # Публичные эндпоинты builder (без авторизации)
  scope "/api/v1/builder", ChatForgeWeb do
    pipe_through :api

    get  "/validate-subdomain", BuilderController, :validate_subdomain
    post "/avatar",             BuilderController, :upload_avatar
  end

  # Защищённые эндпоинты builder (требуют авторизации — вызываются при финализации)
  scope "/api/v1/builder", ChatForgeWeb do
    pipe_through [:api, :authenticated]

    post "/start",      BuilderController, :start
    get  "/state",      BuilderController, :state
    put  "/step/:step", BuilderController, :update_step
    post "/finalize",   BuilderController, :finalize
  end

  # -------------------------------------------------------------------------
  # Маршруты дашборда Creator-а (требуют аутентификации)
  # -------------------------------------------------------------------------

  scope "/api/v1/dashboard", ChatForgeWeb do
    pipe_through [:api, :authenticated]

    get  "/instances",                          DashboardController, :index
    get  "/instance",                           DashboardController, :show
    put  "/instance/settings",                  DashboardController, :update_settings
    post "/instance/avatar",                    DashboardController, :upload_avatar

    # Маршруты с явным instance_id (multi-instance)
    get  "/instances/:instance_id",             DashboardController, :show_by_id
    put  "/instances/:instance_id/settings",    DashboardController, :update_settings_by_id
    post "/instances/:instance_id/avatar",      DashboardController, :upload_avatar_by_id

    # Управление тарифными планами Creator-а
    get    "/plans",                            PlanController, :index
    post   "/plans",                            PlanController, :create
    put    "/plans/:id",                        PlanController, :update
    delete "/plans/:id",                        PlanController, :delete

    # Планы конкретного инстанса (multi-instance)
    get    "/instances/:instance_id/plans",     PlanController, :index_by_instance
    post   "/instances/:instance_id/plans",     PlanController, :create_by_instance

    # Аналитика Creator-а
    get "/analytics/overview", AnalyticsController, :overview
    get "/analytics/messages", AnalyticsController, :messages
    get "/analytics/users",    AnalyticsController, :users
    get "/analytics/revenue",  AnalyticsController, :revenue
  end

  # -------------------------------------------------------------------------
  # Маршруты End User-а (требуют тенант по поддомену)
  # -------------------------------------------------------------------------

  # Публичные маршруты End User-а
  scope "/api/v1/chat/auth", ChatForgeWeb do
    pipe_through [:api, :chat_tenant]

    post "/register", ChatAuthController, :register
    post "/login",    ChatAuthController, :login
    post "/refresh",  ChatAuthController, :refresh
    post "/logout",   ChatAuthController, :logout
  end

  # Защищённые маршруты End User-а (требуют тенант + Bearer-токен)
  scope "/api/v1/chat/auth", ChatForgeWeb do
    pipe_through [:api, :chat_tenant, :authenticated]

    get  "/me",     ChatAuthController, :me
  end

  # -------------------------------------------------------------------------
  # Публичная информация об инстансе (только тенант, без авторизации)
  # -------------------------------------------------------------------------

  scope "/api/v1/chat", ChatForgeWeb do
    pipe_through [:api, :chat_tenant]

    get "/instance", ChatInstanceController, :show

    # Публичный список активных планов тенанта (без аутентификации)
    get "/plans", SubscriptionController, :plans
  end

  # -------------------------------------------------------------------------
  # Маршруты диалогов End User-а (тенант + авторизация)
  # -------------------------------------------------------------------------

  scope "/api/v1/chat", ChatForgeWeb do
    pipe_through [:api, :chat_tenant, :authenticated]

    get    "/conversations",                  ChatController, :index
    post   "/conversations",                  ChatController, :create
    delete "/conversations/:id",              ChatController, :delete
    get    "/conversations/:id/messages",     ChatController, :messages

    # Подписки End User-а
    post "/subscriptions",          SubscriptionController, :create
    get  "/subscriptions/current",  SubscriptionController, :current
  end

  # -------------------------------------------------------------------------
  # Фейковые webhook-уведомления от платёжной системы (без аутентификации)
  # -------------------------------------------------------------------------

  scope "/api/v1/webhooks", ChatForgeWeb do
    pipe_through :api

    post "/payment", WebhookController, :payment
  end

  # -------------------------------------------------------------------------
  # Admin-маршруты (только super_admin)
  # -------------------------------------------------------------------------

  scope "/api/v1/admin", ChatForgeWeb do
    pipe_through [:api, :admin]

    get "/stats",                    AdminController, :stats
    get "/creators",                 AdminController, :list_creators
    get "/creators/:id",             AdminController, :get_creator
    put "/creators/:id/suspend",     AdminController, :suspend_creator
    put "/creators/:id/activate",    AdminController, :activate_creator
    get "/instances",                AdminController, :list_instances
    put "/instances/:id/suspend",    AdminController, :suspend_instance
    put "/instances/:id/activate",   AdminController, :activate_instance
    get "/ai-usage",                 AdminController, :ai_usage
  end
end
