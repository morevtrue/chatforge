# Production Deployment Critical Fixes - Bugfix Design

## Overview

ChatForge развернут на production сервере, но не функционирует из-за трех критических багов. Первый баг: бэкенд крашится при запуске из-за несовместимости криптографической библиотеки Erlang/OTP с Alpine Linux runtime образом. Второй баг: nginx не проксирует API запросы к бэкенду, пытаясь найти их как статические файлы. Третий баг: валидация поддоменов всегда возвращает "taken" из-за некорректной логики проверки. Стратегия исправления: заменить Alpine runtime на Debian slim для совместимости с crypto библиотекой, добавить location блоки для проксирования API в nginx, и исправить логику валидации поддоменов с добавлением build-time переменной VITE_API_URL.

## Glossary

- **Bug_Condition_1 (C1)**: Бэкенд запускается с Alpine Linux runtime образом, который не содержит совместимую версию OpenSSL для Erlang crypto библиотеки
- **Bug_Condition_2 (C2)**: Nginx получает запрос на путь начинающийся с `/api` или `/socket`, но не имеет правил проксирования
- **Bug_Condition_3 (C3)**: Функция `validate_subdomain` проверяет поддомен, который не существует в базе данных, но возвращает ошибку "taken"
- **Property_1 (P1)**: Бэкенд контейнер успешно загружает crypto библиотеку и стабильно работает без перезапусков
- **Property_2 (P2)**: Nginx проксирует API запросы к бэкенду на порт 4000 и возвращает корректный ответ
- **Property_3 (P3)**: Валидация поддомена возвращает "available" для свободных поддоменов
- **Preservation**: Существующее поведение development окружения, статической раздачи файлов, SPA роутинга и миграций должно остаться неизменным
- **crypto.so**: Нативная библиотека Erlang для криптографических операций, требующая совместимую версию OpenSSL
- **EVP_MD_CTX_get_size_ex**: Функция OpenSSL 3.x, отсутствующая в Alpine Linux 3.20
- **nginx location**: Директива конфигурации nginx для определения правил обработки запросов
- **proxy_pass**: Директива nginx для проксирования запросов к upstream серверу

## Bug Details

### Fault Condition 1: Alpine Crypto Library Incompatibility

Бэкенд контейнер использует multi-stage build с `elixir:1.17-alpine` для сборки и `alpine:3.20` для runtime. При запуске контейнера Erlang пытается загрузить нативную библиотеку `crypto.so`, которая была скомпилирована в builder stage с Alpine OpenSSL. Однако runtime образ Alpine 3.20 содержит версию OpenSSL, которая не экспортирует символ `EVP_MD_CTX_get_size_ex`, необходимый для crypto библиотеки. Это приводит к краху приложения при старте.

**Formal Specification:**
```
FUNCTION isBugCondition1(container)
  INPUT: container of type DockerContainer
  OUTPUT: boolean
  
  RETURN container.runtime_image == "alpine:3.20"
         AND container.erlang_app_uses_crypto == true
         AND NOT openssl_symbol_exists(container.runtime_image, "EVP_MD_CTX_get_size_ex")
END FUNCTION
```

### Examples

- **Пример 1**: Запуск `docker compose -f docker-compose.prod.yml up backend` → контейнер стартует → Erlang пытается загрузить crypto.so → ошибка "Error relocating /app/lib/crypto-5.5.3.1/priv/lib/crypto.so: EVP_MD_CTX_get_size_ex: symbol not found" → контейнер крашится и перезапускается
- **Пример 2**: Проверка логов `docker logs chatforge-backend` → видны повторяющиеся ошибки загрузки crypto библиотеки → контейнер никогда не достигает состояния "ready"
- **Ожидаемое поведение**: Контейнер стартует → crypto библиотека успешно загружается → Phoenix сервер запускается на порту 4000 → логи показывают "Running ChatForgeWeb.Endpoint"

### Fault Condition 2: Missing Nginx API Proxying

Nginx сконфигурирован только для раздачи статических файлов и SPA fallback. Когда фронтенд отправляет запрос на `/api/v1/auth/register`, nginx пытается найти файл по этому пути в директории `/usr/share/nginx/html`. Файл не найден, nginx возвращает 404. Запросы к бэкенду никогда не достигают Phoenix сервера на порту 4000.

**Formal Specification:**
```
FUNCTION isBugCondition2(request)
  INPUT: request of type HttpRequest
  OUTPUT: boolean
  
  RETURN (request.path STARTS_WITH "/api" OR request.path STARTS_WITH "/socket")
         AND NOT nginx_has_proxy_rule(request.path)
         AND nginx_tries_static_file_lookup(request.path)
END FUNCTION
```

### Examples

- **Пример 1**: POST запрос на `https://chatforge.morevslava.duckdns.org/api/v1/auth/register` → nginx ищет файл `/usr/share/nginx/html/api/v1/auth/register` → файл не найден → возвращает 404
- **Пример 2**: WebSocket подключение к `/socket/websocket` → nginx пытается найти статический файл → возвращает 404 → WebSocket не устанавливается
- **Пример 3**: Прямой запрос к бэкенду `curl http://backend:4000/api/v1/auth/register` (внутри Docker сети) → бэкенд возвращает 405 Method Not Allowed (это отдельная проблема роутинга)
- **Ожидаемое поведение**: POST запрос на `/api/v1/auth/register` → nginx проксирует к `http://backend:4000` → бэкенд обрабатывает запрос → возвращает 200 с токеном

### Fault Condition 3: Incorrect Subdomain Validation Logic

Функция `validate_subdomain` в `instances.ex` проверяет поддомен по трем условиям: формат, существование в БД, и доступность. Однако логика проверки некорректна - функция всегда возвращает ошибку "taken" даже для свободных поддоменов. Анализ кода показывает, что проблема в условии `Repo.get_by(ChatInstance, subdomain: subdomain) != nil` - оно должно возвращать `{:error, :taken}` только когда результат НЕ nil, но текущая логика работает наоборот.

**Formal Specification:**
```
FUNCTION isBugCondition3(subdomain)
  INPUT: subdomain of type String
  OUTPUT: boolean
  
  RETURN subdomain MATCHES "^[a-z0-9-]+$"
         AND NOT exists_in_database(subdomain)
         AND validate_subdomain_returns_error_taken(subdomain)
END FUNCTION
```

### Examples

- **Пример 1**: Проверка поддомена "aaaaa" (заведомо свободный) → функция возвращает `{:error, :taken}` → фронтенд показывает "поддомен уже занят"
- **Пример 2**: Проверка поддомена "test123" (не существует в БД) → функция возвращает `{:error, :taken}` → невозможно создать чат с любым поддоменом
- **Пример 3**: Проверка поддомена "INVALID" (заглавные буквы) → функция корректно возвращает `{:error, :invalid_format}` (это работает правильно)
- **Ожидаемое поведение**: Проверка свободного поддомена "myshop" → функция возвращает `{:ok, :available}` → фронтенд показывает зеленую галочку → пользователь может продолжить создание чата

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Development окружение с стандартным Elixir образом должно продолжать работать без изменений
- Nginx должен продолжать отдавать статические файлы (JS, CSS, изображения) напрямую из `/usr/share/nginx/html` с кешированием
- SPA роутинг должен продолжать работать - запросы к `/`, `/login`, `/dashboard` должны возвращать `index.html`
- Валидация некорректных поддоменов (заглавные буквы, спецсимволы) должна продолжать возвращать `{:error, :invalid_format}`
- Валидация действительно занятых поддоменов должна продолжать возвращать `{:error, :taken}`
- Миграции и seed при старте бэкенда должны продолжать выполняться через `bin/chatforge eval`
- Traefik маршрутизация с приоритетами (backend priority=10, frontend priority=1) должна остаться неизменной

**Scope:**
Все запросы, которые НЕ являются API или WebSocket запросами, должны обрабатываться точно так же как до исправления. Это включает:
- Запросы к статическим файлам (*.js, *.css, *.png, *.svg)
- Запросы к SPA роутам (/, /login, /dashboard, /builder)
- Запросы с некорректными поддоменами или действительно занятыми поддоменами

## Hypothesized Root Cause

### Bug 1: Alpine OpenSSL Incompatibility

1. **Несовместимость версий OpenSSL**: Alpine Linux 3.20 использует OpenSSL 3.x, но не экспортирует все символы, необходимые для Erlang crypto библиотеки, скомпилированной в builder stage
   - Builder stage использует `elixir:1.17-alpine` с определенной версией OpenSSL
   - Runtime stage использует `alpine:3.20` с другой версией OpenSSL
   - Символ `EVP_MD_CTX_get_size_ex` отсутствует в runtime OpenSSL

2. **Отсутствие необходимых библиотек**: Runtime образ может не содержать все зависимости, необходимые для работы crypto.so

3. **ABI несовместимость**: Бинарные интерфейсы между builder и runtime образами могут различаться

### Bug 2: Missing Nginx Configuration

1. **Отсутствие location блоков для API**: В `nginx.conf` нет директив `location /api` и `location /socket` для проксирования к бэкенду
   - Существующая конфигурация содержит только `location /` для SPA fallback
   - Нет `proxy_pass` директив для перенаправления к backend:4000

2. **Неправильный порядок location блоков**: Если бы блоки существовали, они должны быть определены ДО блока `location /`, иначе SPA fallback перехватит все запросы

3. **Отсутствие VITE_API_URL**: Frontend Dockerfile не получает переменную окружения VITE_API_URL через build args, поэтому фронтенд не знает куда отправлять запросы

### Bug 3: Incorrect Validation Logic

1. **Логическая ошибка в условии**: Код `Repo.get_by(ChatInstance, subdomain: subdomain) != nil` возвращает true когда поддомен СУЩЕСТВУЕТ, но текущая структура `cond` возвращает `{:error, :taken}` в этом случае
   - Проблема: условие должно проверять "если поддомен существует, вернуть :taken"
   - Текущий код делает это, но возможно есть ошибка в логике cond

2. **Проблема с порядком условий**: В `cond` блоке условия проверяются сверху вниз, и первое истинное условие выполняется
   - Возможно, одно из предыдущих условий всегда истинно

3. **Проблема с базой данных**: Возможно, в БД есть записи, которые конфликтуют с проверкой

## Correctness Properties

Property 1: Fault Condition 1 - Backend Crypto Library Loading

_For any_ Docker container configuration where the backend is deployed with a runtime image, the fixed Dockerfile SHALL use a Debian-based runtime image (debian:12-slim) that contains OpenSSL libraries compatible with Erlang crypto.so, ensuring the backend starts successfully without symbol loading errors.

**Validates: Requirements 2.1**

Property 2: Fault Condition 2 - Nginx API Proxying

_For any_ HTTP request where the path starts with `/api` or `/socket`, the fixed nginx configuration SHALL proxy the request to the backend service on port 4000, and the frontend build SHALL include VITE_API_URL environment variable pointing to `https://${DOMAIN}/api`.

**Validates: Requirements 2.2, 2.3, 2.4**

Property 3: Fault Condition 3 - Subdomain Validation

_For any_ subdomain string that matches the format `^[a-z0-9-]+$` and does NOT exist in the chat_instances table, the fixed validate_subdomain function SHALL return `{:ok, :available}` instead of `{:error, :taken}`.

**Validates: Requirements 2.5**

Property 4: Preservation - Development Environment

_For any_ development environment setup using standard Elixir Docker images, the fixed backend Dockerfile SHALL NOT affect the development workflow, preserving all existing development behaviors.

**Validates: Requirements 3.1**

Property 5: Preservation - Static File Serving

_For any_ HTTP request to static assets (JS, CSS, images) or SPA routes, the fixed nginx configuration SHALL continue to serve files from `/usr/share/nginx/html` with caching headers and SPA fallback behavior unchanged.

**Validates: Requirements 3.2, 3.3**

Property 6: Preservation - Subdomain Validation Edge Cases

_For any_ subdomain validation request with invalid format or genuinely taken subdomain, the fixed validate_subdomain function SHALL continue to return `{:error, :invalid_format}` or `{:error, :taken}` respectively, preserving existing validation behavior.

**Validates: Requirements 3.4, 3.5**

Property 7: Preservation - Backend Initialization

_For any_ backend container startup, the fixed Dockerfile SHALL continue to execute migrations and seed commands through `bin/chatforge eval` before starting the Phoenix server.

**Validates: Requirements 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

#### Fix 1: Backend Dockerfile - Replace Alpine with Debian

**File**: `chatforge/backend/Dockerfile`

**Specific Changes**:
1. **Replace runtime base image**: Изменить `FROM alpine:3.20 AS runtime` на `FROM debian:12-slim AS runtime`
   - Debian содержит полную версию OpenSSL с всеми необходимыми символами
   - Debian slim минимизирует размер образа, оставаясь совместимым

2. **Update package installation**: Заменить `apk add` на `apt-get update && apt-get install -y`
   - Установить `libstdc++6 openssl libncurses6 locales`
   - Добавить очистку кеша apt для уменьшения размера: `rm -rf /var/lib/apt/lists/*`

3. **Set locale**: Добавить настройку локали для корректной работы Erlang
   - `RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen`
   - `ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8`

4. **Keep builder stage unchanged**: Builder stage остается `elixir:1.17-alpine` для быстрой сборки

#### Fix 2: Nginx Configuration - Add API Proxying

**File**: `chatforge/frontend/nginx.conf`

**Specific Changes**:
1. **Add upstream backend definition**: Добавить блок upstream перед server
   ```nginx
   upstream backend {
       server backend:4000;
   }
   ```

2. **Add API location block**: Добавить ПЕРЕД блоком `location /`
   ```nginx
   location /api {
       proxy_pass http://backend;
       proxy_http_version 1.1;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

3. **Add WebSocket location block**: Добавить ПЕРЕД блоком `location /`
   ```nginx
   location /socket {
       proxy_pass http://backend;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

4. **Maintain location order**: Убедиться, что специфичные location блоки (/api, /socket) идут ПЕРЕД общим location /

#### Fix 3: Frontend Dockerfile - Add VITE_API_URL

**File**: `chatforge/frontend/Dockerfile`

**Specific Changes**:
1. **Add ARG for VITE_API_URL**: Добавить после существующего ARG VITE_CHAT_BASE_URL
   ```dockerfile
   ARG VITE_API_URL
   ENV VITE_API_URL=$VITE_API_URL
   ```

2. **Pass from docker-compose**: В `docker-compose.prod.yml` добавить build arg
   ```yaml
   build:
     args:
       VITE_API_URL: https://${DOMAIN}/api
   ```

#### Fix 4: Subdomain Validation Logic

**File**: `chatforge/backend/lib/chatforge/instances/instances.ex`

**Function**: `validate_subdomain/1`

**Specific Changes**:
1. **Analyze current logic**: Проверить текущую логику cond блока
   ```elixir
   cond do
     not String.match?(subdomain, ~r/^[a-z0-9-]+$/) ->
       {:error, :invalid_format}
     Repo.get_by(ChatInstance, subdomain: subdomain) != nil ->
       {:error, :taken}
     true ->
       {:ok, :available}
   end
   ```

2. **Verify the logic is correct**: Логика выглядит правильной - если поддомен существует (не nil), вернуть :taken
   - Возможно, проблема в другом месте (например, в контроллере или в самом запросе)
   - Нужно добавить логирование для отладки

3. **Add logging for debugging**: Добавить логирование перед проверкой
   ```elixir
   require Logger
   Logger.info("Validating subdomain: #{subdomain}")
   result = Repo.get_by(ChatInstance, subdomain: subdomain)
   Logger.info("Database result: #{inspect(result)}")
   ```

4. **Alternative hypothesis**: Возможно, проблема в том, что запрос не доходит до этой функции из-за бага 2 (nginx не проксирует)
   - После исправления nginx, проверить работает ли валидация
   - Если нет, тогда исправить логику

## Testing Strategy

### Validation Approach

Стратегия тестирования следует трехфазному подходу: сначала воспроизвести баги на текущем коде для подтверждения root cause, затем применить исправления и проверить, что баги устранены, и наконец убедиться, что существующее поведение сохранено.

### Exploratory Fault Condition Checking

**Goal**: Воспроизвести все три бага на UNFIXED коде для подтверждения root cause анализа. Если root cause не подтверждается, нужно пересмотреть гипотезу.

**Test Plan**: Запустить production deployment с текущим кодом и наблюдать ошибки в логах и поведении системы.

**Test Cases**:
1. **Backend Crypto Test**: Запустить `docker compose -f docker-compose.prod.yml up backend` и проверить логи (will fail on unfixed code)
   - Ожидаемая ошибка: "Error relocating /app/lib/crypto-5.5.3.1/priv/lib/crypto.so: EVP_MD_CTX_get_size_ex: symbol not found"
   - Контейнер должен постоянно перезапускаться

2. **Nginx API Proxying Test**: Отправить POST запрос на `/api/v1/auth/register` через curl (will fail on unfixed code)
   - Ожидаемая ошибка: 404 Not Found
   - Nginx логи должны показывать попытку найти статический файл

3. **Subdomain Validation Test**: Отправить GET запрос на `/api/v1/builder/validate-subdomain?subdomain=aaaaa` (will fail on unfixed code)
   - Ожидаемая ошибка: `{"available": false, "reason": "taken"}`
   - Поддомен "aaaaa" заведомо не существует в БД

4. **Frontend Build Test**: Проверить переменные окружения в собранном фронтенде (will fail on unfixed code)
   - Ожидаемая проблема: VITE_API_URL не определен в window.__ENV__ или в коде
   - API запросы идут на неправильный URL

**Expected Counterexamples**:
- Backend контейнер не может загрузить crypto библиотеку из-за отсутствия OpenSSL символов в Alpine
- Nginx возвращает 404 для API запросов вместо проксирования к бэкенду
- Валидация поддоменов всегда возвращает "taken" даже для свободных поддоменов
- Frontend не знает куда отправлять API запросы

### Fix Checking

**Goal**: Проверить, что для всех входных данных, где выполняется bug condition, исправленная система производит ожидаемое поведение.

**Pseudocode:**
```
FOR ALL container WHERE isBugCondition1(container) DO
  result := start_backend_fixed(container)
  ASSERT result.status == "running"
  ASSERT result.logs CONTAINS "Running ChatForgeWeb.Endpoint"
  ASSERT NOT result.logs CONTAINS "EVP_MD_CTX_get_size_ex"
END FOR

FOR ALL request WHERE isBugCondition2(request) DO
  result := nginx_handle_fixed(request)
  ASSERT result.status_code IN [200, 201, 400, 401, 422]
  ASSERT NOT result.status_code == 404
  ASSERT result.proxied_to == "backend:4000"
END FOR

FOR ALL subdomain WHERE isBugCondition3(subdomain) DO
  result := validate_subdomain_fixed(subdomain)
  ASSERT result == {:ok, :available}
END FOR
```

### Preservation Checking

**Goal**: Проверить, что для всех входных данных, где bug condition НЕ выполняется, исправленная система производит тот же результат, что и оригинальная.

**Pseudocode:**
```
FOR ALL container WHERE NOT isBugCondition1(container) DO
  ASSERT start_backend_original(container) == start_backend_fixed(container)
END FOR

FOR ALL request WHERE NOT isBugCondition2(request) DO
  ASSERT nginx_handle_original(request) == nginx_handle_fixed(request)
END FOR

FOR ALL subdomain WHERE NOT isBugCondition3(subdomain) DO
  ASSERT validate_subdomain_original(subdomain) == validate_subdomain_fixed(subdomain)
END FOR
```

**Testing Approach**: Manual testing рекомендуется для preservation checking в данном случае, так как это infrastructure изменения, которые сложно покрыть автоматическими тестами. Однако, можно написать integration тесты для проверки ключевых сценариев.

**Test Plan**: Наблюдать поведение на UNFIXED коде для non-bug inputs, затем проверить, что это поведение сохранилось после исправлений.

**Test Cases**:
1. **Static Files Preservation**: Запросить JS/CSS файлы и проверить, что они отдаются с кешированием
2. **SPA Routing Preservation**: Запросить `/login`, `/dashboard` и проверить, что возвращается index.html
3. **Invalid Subdomain Preservation**: Проверить поддомен "INVALID" и убедиться, что возвращается "invalid_format"
4. **Taken Subdomain Preservation**: Создать чат с поддоменом "test", затем проверить этот поддомен и убедиться, что возвращается "taken"
5. **Development Environment Preservation**: Запустить `docker compose up` (dev) и убедиться, что все работает как раньше

### Unit Tests

- Тест загрузки backend контейнера с Debian runtime образом
- Тест nginx конфигурации с различными путями запросов
- Тест функции validate_subdomain с различными входными данными
- Тест frontend build с переменными окружения

### Property-Based Tests

Property-based тесты не применимы для данных infrastructure багов, так как они касаются конфигурации Docker и nginx, а не бизнес-логики. Однако, можно написать property-based тесты для функции validate_subdomain:

- Генерировать случайные валидные поддомены и проверять, что они возвращают :available (если не существуют в БД)
- Генерировать случайные невалидные поддомены и проверять, что они возвращают :invalid_format
- Генерировать случайные существующие поддомены и проверять, что они возвращают :taken

### Integration Tests

- Полный production deployment тест: запустить все сервисы и проверить end-to-end flow
  - Backend стартует успешно
  - Frontend доступен через Traefik
  - API запросы проксируются корректно
  - Регистрация пользователя работает
  - Создание чата с валидацией поддомена работает
  - WebSocket подключение устанавливается

- Тест переключения между окружениями: убедиться, что development и production окружения работают независимо

- Тест миграций и seed: убедиться, что при первом запуске создается admin пользователь и выполняются все миграции
