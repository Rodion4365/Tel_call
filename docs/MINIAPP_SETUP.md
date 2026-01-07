# Настройка Telegram MiniApp для Tel Call

## Обзор

Это руководство описывает, как настроить все необходимые environment переменные для работы Telegram MiniApp на Selectel хостинге.

## 1. Backend Environment Variables

Создайте файл `backend/.env` на основе `backend/.env.example`:

```bash
cp backend/.env.example backend/.env
```

### Обязательные переменные:

```bash
# === БАЗА ДАННЫХ ===
# Для Docker используйте имя сервиса 'postgres' как хост
DATABASE_URL=postgresql+asyncpg://app:apppassword@postgres:5432/app

# === БЕЗОПАСНОСТЬ ===
# ВАЖНО: сгенерируйте уникальный ключ!
# Команда для генерации: python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=YOUR_SECRET_KEY_HERE_MIN_32_CHARS

# === TELEGRAM BOT ===
# Получите токен от @BotFather в Telegram
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
BOT_USERNAME=your_bot_name_bot

# Webhook URL для получения обновлений от Telegram
BOT_WEBHOOK_URL=https://api.callwith.ru/api/telegram/webhook

# === CORS ===
# Разрешенные домены для frontend (без пробелов!)
CORS_ALLOW_ORIGINS=https://app.callwith.ru
```

### Опциональные переменные:

```bash
# === ПРИЛОЖЕНИЕ ===
APP_NAME=Tel Call Backend
DEBUG=false
ACCESS_TOKEN_EXPIRE_MINUTES=43200  # 30 дней

# === WebRTC СЕРВЕРЫ ===
STUN_SERVERS=stun:stun.l.google.com:19302
# TURN_SERVERS=turns:your-turn-server.com:5349?transport=tcp

# === ЛИМИТЫ ===
MAX_PARTICIPANTS_PER_CALL=30
MAX_ACTIVE_CALLS_PER_USER=5
MAX_CALL_DURATION_HOURS=12
MAX_WEBSOCKET_MESSAGE_SIZE=1048576
EMPTY_ROOM_CLEANUP_MINUTES=5
```

## 2. Infrastructure Environment Variables

Создайте файл `infra/.env` на основе `infra/.env.example`:

```bash
cp infra/.env.example infra/.env
```

### Настройка доменов:

```bash
# === ДОМЕНЫ ===
BACKEND_HOST=api.callwith.ru
FRONTEND_HOST=app.callwith.ru

# === POSTGRESQL ===
POSTGRES_USER=app
POSTGRES_PASSWORD=YOUR_STRONG_PASSWORD_HERE
POSTGRES_DB=app

# === WebRTC ===
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVERS=

# === TURN SERVER (опционально) ===
TURN_REALM=callwith.ru
TURN_SERVER_NAME=turn.callwith.ru
TURN_USERNAME=your_turn_user
TURN_PASSWORD=your_turn_password
# TURN_EXTRA_OPTS=--external-ip=88.218.68.63
```

## 3. Настройка Telegram Bot

### Шаг 1: Создание бота

1. Откройте Telegram и найдите [@BotFather](https://t.me/BotFather)
2. Отправьте команду `/newbot`
3. Следуйте инструкциям для создания бота
4. Скопируйте полученный `BOT_TOKEN`

### Шаг 2: Настройка MiniApp

1. В диалоге с @BotFather выберите вашего бота
2. Отправьте команду `/newapp`
3. Выберите бота
4. Заполните данные приложения:
   - **Title**: Tel Call
   - **Description**: Video calls in Telegram
   - **Photo**: Загрузите иконку приложения (512x512 px)
   - **GIF/Video**: (опционально)
   - **Web App URL**: `https://app.callwith.ru`

### Шаг 3: Настройка команд бота

```
/setcommands

start - Запустить приложение
help - Помощь
```

### Шаг 4: Настройка webhook

После деплоя приложения webhook настроится автоматически при первом запуске backend.

Проверка webhook:
```bash
curl https://api.callwith.ru/api/telegram/webhook-info
```

## 4. Frontend Build Configuration

Frontend автоматически получает правильные URL через build arguments в docker-compose.yml:

```yaml
frontend:
  build:
    args:
      - VITE_API_BASE_URL=https://${BACKEND_HOST}
      - VITE_WS_BASE_URL=wss://${BACKEND_HOST}
```

Эти переменные встраиваются в production build на этапе сборки.

## 5. DNS Настройка

В панели управления Selectel добавьте A-записи:

| Тип | Имя | Значение | TTL |
|-----|-----|----------|-----|
| A | @ | 88.218.68.63 | 300 |
| A | app | 88.218.68.63 | 300 |
| A | api | 88.218.68.63 | 300 |

## 6. SSL Сертификаты (Let's Encrypt)

После настройки DNS раскомментируйте в `infra/docker-compose.yml`:

```yaml
# Traefik HTTPS redirect
- --entrypoints.web.http.redirections.entrypoint.to=websecure
- --entrypoints.web.http.redirections.entrypoint.scheme=https
```

И добавьте конфигурацию Let's Encrypt:

```yaml
- --certificatesresolvers.letsencrypt.acme.email=your-email@example.com
- --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
- --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
```

## 7. Проверка работы

### Backend:
```bash
curl https://api.callwith.ru/health
# Должно вернуть: {"status":"ok"}
```

### Frontend:
```bash
curl -I https://app.callwith.ru
# Должно вернуть: 200 OK
```

### WebSocket:
Откройте в браузере: `https://app.callwith.ru` и проверьте консоль на наличие WebSocket подключения.

## 8. Деплой

### Первый деплой:

```bash
cd infra
docker compose build --no-cache
docker compose up -d
```

### Обновление:

```bash
cd infra
git pull origin main
docker compose build
docker compose up -d
```

## Troubleshooting

### Backend не отвечает

```bash
docker compose logs backend
docker compose exec backend wget -qO- http://localhost:8000/health
```

### Frontend показывает ошибку подключения

Проверьте, что в браузере правильно определяется API URL:
1. Откройте DevTools (F12)
2. Вкладка Console
3. Найдите: `[apiClient] API_BASE_URL = ...`

Должно быть: `https://api.callwith.ru`

### WebSocket не подключается

Проверьте логи backend на наличие ошибок подключения:
```bash
docker compose logs backend | grep -i websocket
```

## Полезные команды

```bash
# Просмотр логов всех сервисов
docker compose logs -f

# Просмотр логов конкретного сервиса
docker compose logs -f backend
docker compose logs -f frontend

# Перезапуск сервиса
docker compose restart backend

# Проверка состояния контейнеров
docker compose ps

# Просмотр использования ресурсов
docker stats
```
