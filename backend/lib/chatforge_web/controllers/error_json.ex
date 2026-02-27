defmodule ChatForgeWeb.ErrorJSON do
  @moduledoc """
  Рендеринг ошибок в формате JSON.
  """

  # Стандартные HTTP-ошибки
  def render("404.json", _assigns) do
    %{errors: %{detail: "Not Found"}}
  end

  def render("500.json", _assigns) do
    %{errors: %{detail: "Internal Server Error"}}
  end

  # Любые другие ошибки
  def render(template, _assigns) do
    %{errors: %{detail: Phoenix.Controller.status_message_from_template(template)}}
  end
end
