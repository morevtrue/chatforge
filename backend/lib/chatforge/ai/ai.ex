defmodule ChatForge.AI do
  @moduledoc """
  Контекст AI: stateless оркестратор вызовов OpenAI API.

  Зона ответственности:
  - Сборка списка сообщений для OpenAI Chat API
  - Вызов OpenAI с streaming через Req
  - Логирование использования (токены, стоимость) в ai_usage_logs

  Не хранит состояния и не владеет бизнес-данными.
  Chat контекст вызывает AI только через публичный API этого модуля.
  """

  require Logger

  alias ChatForge.AI.AIUsageLog
  alias ChatForge.Repo

  # -------------------------------------------------------------------------
  # Конфигурация
  # -------------------------------------------------------------------------

  @doc """
  Возвращает ключ OpenAI API из конфигурации.
  Падает при старте если OPENAI_API_KEY не задан.
  """
  def api_key do
    Application.fetch_env!(:chatforge, :openai_api_key)
  end

  @doc "Возвращает модель AI (по умолчанию gpt-4o-mini)."
  def model do
    Application.get_env(:chatforge, :ai_model, "gpt-4o-mini")
  end

  @doc "Возвращает базовый URL OpenAI API."
  def base_url do
    Application.get_env(:chatforge, :ai_base_url, "https://api.openai.com/v1")
  end

  # -------------------------------------------------------------------------
  # Публичный API
  # -------------------------------------------------------------------------

  @doc """
  Собирает список сообщений для OpenAI Chat API.
  Первый элемент — system prompt, затем сообщения диалога в хронологическом порядке.

  ## Пример

      iex> AI.build_messages("Ты помощник", [%{role: "user", content: "Привет"}])
      [%{role: "system", content: "Ты помощник"}, %{role: "user", content: "Привет"}]
  """
  def build_messages(system_prompt, messages) do
    system = [%{role: "system", content: system_prompt}]
    msgs = Enum.map(messages, fn msg -> %{role: msg.role, content: msg.content} end)
    system ++ msgs
  end

  @doc """
  Вызывает OpenAI Chat Completions API без streaming.

  callback вызывается один раз с полным ответом.
  После завершения сохраняет AIUsageLog.

  Возвращает:
  - `{:ok, %{content: full_content, input_tokens: n, output_tokens: m}}`
  - `{:error, %{code: status, message: body}}`
  - `{:error, :stream_interrupted}`
  """
  def complete(chat_instance_id, conversation_id, messages, callback) do
    url = "#{base_url()}/chat/completions"

    body = %{
      model: model(),
      messages: messages,
      stream: false
    }

    result =
      Req.post(url,
        json: body,
        headers: [
          {"authorization", "Bearer #{api_key()}"},
          {"content-type", "application/json"}
        ],
        receive_timeout: 60_000
      )

    case result do
      {:ok, %{status: status, body: response_body}} when status in 200..299 ->
        content = get_in(response_body, ["choices", Access.at(0), "message", "content"]) || ""
        input_tokens = get_in(response_body, ["usage", "prompt_tokens"]) || 0
        output_tokens = get_in(response_body, ["usage", "completion_tokens"]) || 0

        Logger.debug("AI.complete успех: #{byte_size(content)} байт контента")

        # Вызываем callback с полным контентом
        callback.(content)

        # Логируем использование
        log_usage(%{
          chat_instance_id: chat_instance_id,
          conversation_id: conversation_id,
          provider: "openai",
          model: model(),
          input_tokens: input_tokens,
          output_tokens: output_tokens
        })

        {:ok, %{content: content, input_tokens: input_tokens, output_tokens: output_tokens}}

      {:ok, %{status: status, body: body}} ->
        message = extract_error_message(body)
        Logger.error("AI.complete HTTP #{status}: #{message}")
        {:error, %{code: status, message: message}}

      {:error, reason} ->
        Logger.error("AI.complete ошибка соединения: #{inspect(reason)}")
        {:error, :stream_interrupted}
    end
  end

  @doc """
  Сохраняет запись об использовании AI API.
  При ошибке логирует через Logger.error и не прерывает основной поток.
  """
  def log_usage(attrs) do
    cost = calculate_cost(attrs.model, attrs.input_tokens, attrs.output_tokens)

    attrs_with_cost = Map.put(attrs, :cost, cost)

    case %AIUsageLog{} |> AIUsageLog.changeset(attrs_with_cost) |> Repo.insert() do
      {:ok, log} ->
        {:ok, log}

      {:error, changeset} ->
        Logger.error("AI.log_usage ошибка сохранения: #{inspect(changeset.errors)}")
        {:error, changeset}
    end
  end

  # -------------------------------------------------------------------------
  # Приватные функции
  # -------------------------------------------------------------------------

  # Рассчитывает стоимость запроса в USD на основе тарифов модели
  defp calculate_cost(model_name, input_tokens, output_tokens) do
    # Тарифы в USD за 1M токенов (актуальные на 2025)
    {input_rate, output_rate} =
      case model_name do
        "gpt-4o"       -> {Decimal.new("5.0"), Decimal.new("15.0")}
        "gpt-4o-mini"  -> {Decimal.new("0.15"), Decimal.new("0.60")}
        "gpt-4-turbo"  -> {Decimal.new("10.0"), Decimal.new("30.0")}
        "gpt-3.5-turbo" -> {Decimal.new("0.5"), Decimal.new("1.5")}
        _              -> {Decimal.new("0.15"), Decimal.new("0.60")}
      end

    million = Decimal.new("1000000")

    input_cost  = Decimal.mult(Decimal.div(Decimal.new(input_tokens), million), input_rate)
    output_cost = Decimal.mult(Decimal.div(Decimal.new(output_tokens), million), output_rate)

    Decimal.add(input_cost, output_cost)
  end

  # Извлекает сообщение об ошибке из тела ответа OpenAI
  defp extract_error_message(body) when is_map(body) do
    get_in(body, ["error", "message"]) || "unknown error"
  end

  defp extract_error_message(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} -> extract_error_message(decoded)
      _ -> body
    end
  end

  defp extract_error_message(_), do: "unknown error"
end
