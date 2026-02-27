.PHONY: up down db.setup db.migrate db.reset backend frontend

# Поднять все сервисы инфраструктуры (postgres, redis, minio, traefik)
up:
	docker compose up -d

# Остановить все сервисы
down:
	docker compose down

# Создать БД и применить все миграции
db.setup:
	cd backend && mix ecto.setup

# Применить новые миграции
db.migrate:
	cd backend && mix ecto.migrate

# Сбросить и пересоздать БД с нуля
db.reset:
	cd backend && mix ecto.reset

# Запустить Phoenix-бэкенд в режиме разработки
backend:
	cd backend && mix phx.server

# Запустить React-фронтенд в режиме разработки
frontend:
	cd frontend && npm run dev
