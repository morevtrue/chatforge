defmodule ChatForge.Repo.Migrations.AddFreeMessagesLimitToChatInstances do
  use Ecto.Migration

  def change do
    alter table(:chat_instances) do
      add :free_messages_limit, :integer, null: true
    end
  end
end
