defmodule ChatForge.Instances.S3Adapter do
  @moduledoc """
  Адаптер для загрузки файлов в S3-совместимое хранилище (MinIO в dev, AWS S3 в prod).
  Использует библиотеку ex_aws.
  """

  @doc """
  Загружает файл в S3 по указанному ключу.
  Возвращает {:ok, public_url} или {:error, reason}.
  """
  def upload(key, file_path, content_type) do
    bucket = Application.get_env(:chatforge, :s3)[:bucket] || "chatforge-avatars"
    public_url_base = Application.get_env(:chatforge, :s3)[:public_url]

    file_binary = File.read!(file_path)

    bucket
    |> ExAws.S3.put_object(key, file_binary, content_type: content_type, acl: :public_read)
    |> ExAws.request()
    |> case do
      {:ok, _} ->
        url = "#{public_url_base}/#{bucket}/#{key}"
        {:ok, url}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
