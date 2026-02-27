import Ecto.Query
instances = ChatForge.Repo.all(from i in ChatForge.Instances.ChatInstance, order_by: [desc: i.inserted_at], limit: 3, preload: [:instance_settings])
Enum.each(instances, fn i ->
  s = i.instance_settings
  IO.puts("Instance: #{i.name} | primary: #{inspect(s && s.primary_color)} | greeting: #{inspect(s && s.greeting_text)} | questions: #{inspect(s && s.example_questions)}")
end)
