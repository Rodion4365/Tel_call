# Инструкции по деплою на сервер Selectel

## Что было сделано

✅ Backend настроен и работает по HTTP
✅ Frontend переключен на production режим с nginx
✅ TLS временно отключен (будет настроен после DNS)
✅ Все изменения в ветке `claude/migrate-selectel-hosting-3WsgT`

## Команды для деплоя

Выполните следующие команды на сервере:

```bash
# 1. Подключитесь к серверу
ssh root@88.218.68.63

# 2. Перейдите в директорию проекта
cd /opt/app/projects/tel_call

# 3. Получите последние изменения
git fetch origin
git checkout claude/migrate-selectel-hosting-3WsgT
git pull origin claude/migrate-selectel-hosting-3WsgT

# 4. Перейдите в директорию infra
cd infra

# 5. Пересоберите frontend с правильными build args
docker compose build --no-cache frontend

# 6. Перезапустите все сервисы
docker compose up -d

# 7. Проверьте статус контейнеров
docker compose ps

# 8. Проверьте логи (если нужно)
docker compose logs -f --tail=100
```

## Проверка работоспособности

После деплоя проверьте, что всё работает:

```bash
# Проверка backend
curl -H "Host: api.callwith.ru" http://127.0.0.1/health
# Ожидаемый результат: {"status":"ok"}

# Проверка frontend
curl -I -H "Host: app.callwith.ru" http://127.0.0.1
# Ожидаемый результат: HTTP/1.1 200 OK

# Проверка через реальные домены (если DNS настроен)
curl http://api.callwith.ru/health
curl -I http://app.callwith.ru
```

## Что работает сейчас

- ✅ Backend доступен по HTTP на `api.callwith.ru`
- ✅ Frontend доступен по HTTP на `app.callwith.ru`
- ✅ WebSocket будет работать через `ws://api.callwith.ru`
- ✅ Traefik правильно роутит запросы

## Что нужно сделать дальше

### 1. Настроить DNS (обязательно!)

В панели управления Selectel добавьте A-записи:

| Тип | Имя | Значение      | TTL |
|-----|-----|---------------|-----|
| A   | @   | 88.218.68.63  | 300 |
| A   | app | 88.218.68.63  | 300 |
| A   | api | 88.218.68.63  | 300 |

После настройки DNS подождите 5-15 минут для распространения.

Проверка DNS:
```bash
nslookup api.callwith.ru
nslookup app.callwith.ru
```

### 2. Настроить Telegram Bot

1. Создайте бота через [@BotFather](https://t.me/BotFather):
   ```
   /newbot
   ```

2. Получите токен и добавьте в `backend/.env`:
   ```bash
   BOT_TOKEN=123456789:ваш_токен_здесь
   BOT_USERNAME=your_bot_name_bot
   ```

3. Создайте MiniApp:
   ```
   /newapp
   ```
   - Выберите бота
   - Title: Tel Call
   - Description: Video calls in Telegram
   - Web App URL: `http://app.callwith.ru` (пока HTTP, потом поменяем на HTTPS)

4. Перезапустите backend:
   ```bash
   cd /opt/app/projects/tel_call/infra
   docker compose restart backend
   ```

### 3. Включить HTTPS (после настройки DNS)

Когда DNS будет работать, включите HTTPS:

1. Отредактируйте `infra/docker-compose.yml`:
   - Раскомментируйте секцию HTTPS CONFIGURATION (строки 43-47)
   - Замените `your-email@example.com` на свой email
   - Измените build args frontend:
     ```yaml
     - VITE_API_BASE_URL=https://${BACKEND_HOST}
     - VITE_WS_BASE_URL=wss://${BACKEND_HOST}
     ```
   - Добавьте в labels backend (после строки 73):
     ```yaml
     - traefik.http.routers.backend.entrypoints=web,websecure
     - traefik.http.routers.backend.tls=true
     - traefik.http.routers.backend.tls.certresolver=letsencrypt
     ```
   - Добавьте в labels frontend (после строки 86):
     ```yaml
     - traefik.http.routers.frontend.entrypoints=web,websecure
     - traefik.http.routers.frontend.tls=true
     - traefik.http.routers.frontend.tls.certresolver=letsencrypt
     ```

2. Создайте директорию для сертификатов:
   ```bash
   mkdir -p /opt/app/projects/tel_call/infra/letsencrypt
   touch /opt/app/projects/tel_call/infra/letsencrypt/acme.json
   chmod 600 /opt/app/projects/tel_call/infra/letsencrypt/acme.json
   ```

3. Добавьте volume в docker-compose.yml (в секции reverse-proxy volumes):
   ```yaml
   - ./letsencrypt:/letsencrypt
   ```

4. Пересоберите и перезапустите:
   ```bash
   docker compose build --no-cache
   docker compose up -d
   ```

5. Проверьте получение сертификата:
   ```bash
   docker compose logs reverse-proxy | grep -i acme
   ```

6. Обновите URL в Telegram MiniApp на `https://app.callwith.ru`

## Troubleshooting

### Frontend не открывается
```bash
# Проверьте логи
docker compose logs frontend

# Убедитесь, что контейнер запущен
docker compose ps frontend

# Проверьте nginx внутри контейнера
docker compose exec frontend ls -la /usr/share/nginx/html
```

### Backend возвращает ошибки
```bash
# Проверьте логи
docker compose logs backend

# Проверьте переменные окружения
docker compose exec backend env | grep -E "DATABASE|BOT_TOKEN"

# Проверьте подключение к БД
docker compose exec backend python -c "from app.database import engine; print('DB OK')"
```

### Traefik не видит сервисы
```bash
# Проверьте конфигурацию Traefik
docker compose logs reverse-proxy

# Откройте Traefik dashboard
# В браузере: http://88.218.68.63:8080
```

## Полезные команды

```bash
# Просмотр всех логов
docker compose logs -f

# Просмотр логов конкретного сервиса
docker compose logs -f backend
docker compose logs -f frontend

# Перезапуск сервиса
docker compose restart backend

# Пересборка и перезапуск
docker compose build backend && docker compose up -d backend

# Проверка использования ресурсов
docker stats

# Очистка неиспользуемых образов
docker system prune -f
```
