defmodule ChatForge.Analytics.EventHandler do
  @moduledoc """
  GenServer — слушает PubSub-события и записывает их в аналитику.

  Подписывается на топики:
  - "accounts:users"     — регистрация Creator-ов
  - "chat:messages"      — отправка сообщений (глобальный топик)
  - "billing:subscriptions" — создание/истечение подписок
  - "instances"          — создание инстансов

  Не содержит бизнес-логики — только маппинг событий на Analytics.track/3.
  """

  use GenServer
  require Logger

  alias ChatForge.Analytics

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @impl true
  def init(_) do
    # Подписываемся на все нужные топики
    Phoenix.PubSub.subscribe(ChatForge.PubSub, "accounts:users")
    Phoenix.PubSub.subscribe(ChatForge.PubSub, "chat:messages")
    Phoenix.PubSub.subscribe(ChatForge.PubSub, "billing:subscriptions")
    Phoenix.PubSub.subscribe(ChatForge.PubSub, "instances")

    Logger.info("Analytics.EventHandler started, subscribed to PubSub topics")
    {:ok, []}
  end

  # =========================================================================
  # Обработчики событий
  # =========================================================================

  # Регистрация нового пользователя (Creator или EndUser)
  @impl true
  def handle_info({:user_registered, payload}, state) do
    tenant_id = Map.get(payload, :tenant_id)
    Analytics.track("user_registered", tenant_id, stringify_keys(payload))
    {:noreply, state}
  end

  # Отправка сообщения (глобальный топик chat:messages)
  @impl true
  def handle_info({:message_sent, payload}, state) do
    tenant_id = Map.get(payload, :tenant_id)
    Analytics.track("message_sent", tenant_id, stringify_keys(payload))
    {:noreply, state}
  end

  # Создание подписки
  @impl true
  def handle_info({:subscription_created, payload}, state) do
    tenant_id = Map.get(payload, :tenant_id)
    Analytics.track("subscription_created", tenant_id, stringify_keys(payload))
    {:noreply, state}
  end

  # Истечение подписки
  @impl true
  def handle_info({:subscription_expired, payload}, state) do
    tenant_id = Map.get(payload, :tenant_id)
    Analytics.track("subscription_expired", tenant_id, stringify_keys(payload))
    {:noreply, state}
  end

  # Создание инстанса
  @impl true
  def handle_info({:instance_created, instance}, state) do
    Analytics.track("instance_created", instance.id, %{
      "instance_id" => instance.id,
      "creator_id" => instance.creator_id
    })
    {:noreply, state}
  end

  # Игнорируем неизвестные сообщения
  @impl true
  def handle_info(msg, state) do
    Logger.debug("Analytics.EventHandler: ignoring unknown message: #{inspect(msg)}")
    {:noreply, state}
  end

  # =========================================================================
  # Приватные функции
  # =========================================================================

  # Конвертируем atom-ключи в строки для хранения в JSONB
  defp stringify_keys(map) when is_map(map) do
    Map.new(map, fn {k, v} -> {to_string(k), v} end)
  end

  defp stringify_keys(other), do: %{"data" => inspect(other)}
end
