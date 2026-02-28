# Bugfix Requirements Document

## Introduction

ChatForge развернут на production сервере (chatforge.morevslava.duckdns.org), но не функционирует из-за трех критических багов, блокирующих работу всей системы. Бэкенд не запускается из-за несовместимости криптографической библиотеки с Alpine Linux, фронтенд не может взаимодействовать с API из-за отсутствия проксирования в nginx, а валидация поддоменов работает некорректно. Эти баги делают невозможным использование приложения в production.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN бэкенд контейнер запускается в production с Alpine Linux base image THEN система крашится с ошибкой "Unable to load crypto library. Failed with error: load_failed, Failed to load NIF library: 'Error relocating /app/lib/crypto-5.5.3.1/priv/lib/crypto.so: EVP_MD_CTX_get_size_ex: symbol not found'" и контейнер постоянно перезапускается

1.2 WHEN пользователь отправляет POST запрос на `/api/v1/auth/register` с фронтенда THEN nginx возвращает 404 ошибку, пытаясь найти файл в статической директории вместо проксирования запроса к бэкенду

1.3 WHEN пользователь отправляет прямой запрос к бэкенду на `/api/v1/auth/register` минуя nginx THEN бэкенд возвращает 405 (Method Not Allowed) вместо обработки POST запроса

1.4 WHEN фронтенд собирается в production без переменной окружения VITE_API_URL THEN приложение не знает куда отправлять API запросы и использует некорректный URL

1.5 WHEN пользователь проверяет доступность любого поддомена (включая заведомо свободные типа "aaaaa") THEN система всегда возвращает ошибку "поддомен уже занят"

### Expected Behavior (Correct)

2.1 WHEN бэкенд контейнер запускается в production THEN система SHALL успешно загружать криптографическую библиотеку, стабильно работать без перезапусков и логировать успешный старт приложения

2.2 WHEN пользователь отправляет POST запрос на `/api/v1/auth/register` с фронтенда THEN nginx SHALL проксировать запрос к бэкенду на порт 4000 и возвращать корректный ответ от API

2.3 WHEN пользователь отправляет запрос на любой путь начинающийся с `/api` или `/socket` THEN nginx SHALL проксировать запрос к бэкенду без попыток найти файл в статической директории

2.4 WHEN фронтенд собирается в production THEN Docker build SHALL передавать переменную VITE_API_URL со значением `https://${DOMAIN}/api` для корректной работы API клиента

2.5 WHEN пользователь проверяет доступность свободного поддомена THEN система SHALL возвращать статус "available" и позволять использовать этот поддомен для создания чата

### Unchanged Behavior (Regression Prevention)

3.1 WHEN бэкенд работает в development окружении с стандартным Elixir образом THEN система SHALL CONTINUE TO работать без изменений в поведении

3.2 WHEN пользователь запрашивает статические файлы фронтенда (JS, CSS, изображения) THEN nginx SHALL CONTINUE TO отдавать их напрямую из директории `/usr/share/nginx/html` с кешированием

3.3 WHEN пользователь обращается к корневому пути `/` или любому SPA роуту THEN nginx SHALL CONTINUE TO возвращать `index.html` для корректной работы React Router

3.4 WHEN пользователь проверяет поддомен с некорректным форматом (заглавные буквы, спецсимволы) THEN система SHALL CONTINUE TO возвращать ошибку "invalid_format"

3.5 WHEN пользователь проверяет поддомен который действительно занят в базе данных THEN система SHALL CONTINUE TO возвращать ошибку "taken"

3.6 WHEN бэкенд выполняет миграции и seed при старте THEN система SHALL CONTINUE TO выполнять команды `bin/chatforge eval 'ChatForge.Release.migrate()'` и `bin/chatforge eval 'ChatForge.Release.seed()'` перед запуском сервера

3.7 WHEN Traefik маршрутизирует запросы между фронтендом и бэкендом THEN система SHALL CONTINUE TO использовать приоритеты (backend priority=10, frontend priority=1) для корректного разделения трафика
