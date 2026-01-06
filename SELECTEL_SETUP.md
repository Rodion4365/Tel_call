# 🚀 Настройка проекта на Selectel с нуля

## 📋 Шаги для развертывания

### 1️⃣ На сервере: Создайте infra/.env

```bash
cd /opt/app/projects/tel_call
nano infra/.env
```

Минимальная конфигурация для Docker Compose:

```bash
# Домены (замените на свои)
BACKEND_HOST=api.ваш-домен.com
FRONTEND_HOST=app.ваш-домен.com

# PostgreSQL (можно оставить по умолчанию или изменить)
POSTGRES_USER=app
POSTGRES_PASSWORD=apppassword
POSTGRES_DB=app

# WebRTC (опционально)
STUN_SERVERS=stun:stun.l.google.com:19302
```

### 2️⃣ Создайте backend/.env

```bash
nano backend/.env
```

Минимальная конфигурация:

```bash
# База данных (должна совпадать с POSTGRES_* из infra/.env)
DATABASE_URL=postgresql://app:apppassword@postgres:5432/app

# Секретный ключ (сгенерируйте случайный!)
SECRET_KEY=ваш-очень-длинный-случайный-ключ-минимум-32-символа

# Telegram бот (получите от @BotFather)
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
BOT_USERNAME=your_bot_name_bot

# URL для webhook (ваш публичный домен)
BOT_WEBHOOK_URL=https://api.ваш-домен.com/api/telegram/webhook

# CORS (ваш фронтенд домен)
CORS_ALLOW_ORIGINS=https://app.ваш-домен.com

# Опционально
DEBUG=false
STUN_SERVERS=stun:stun.l.google.com:19302
```

**Генерация SECRET_KEY:**
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3️⃣ Инициализация базы данных (опционально)

Можно инициализировать БД заранее, или пропустить этот шаг - таблицы создадутся автоматически при запуске backend:

```bash
cd backend
chmod +x reset_database.sh
./reset_database.sh
```

Скрипт автоматически:
- ✅ Запустит PostgreSQL если нужно
- ✅ Удалит все таблицы
- ✅ Создаст все таблицы заново через SQLAlchemy

### 4️⃣ Запуск приложения

```bash
cd /opt/app/projects/tel_call/infra
docker compose up -d
```

**Важно**: Entrypoint автоматически создаст все таблицы при запуске если их еще нет.

### 5️⃣ Проверка

```bash
# Проверка логов бэкенда
docker compose logs backend

# Проверка таблиц в БД
docker compose exec postgres psql -U app -d app -c "\dt"
```

Должны быть созданы таблицы:
- ✅ `users`
- ✅ `calls`
- ✅ `participants`
- ✅ `call_stats`
- ✅ `friend_links`

## 🔧 Если что-то пошло не так

### Проблема: "ModuleNotFoundError: No module named 'app'"

```bash
# Запустите скрипт из директории backend
cd backend
./reset_database.sh
```

### Проблема: "Cannot connect to database"

Проверьте:
1. PostgreSQL запущен: `docker compose ps postgres`
2. Переменная DATABASE_URL в backend/.env правильная
3. Пароль совпадает с docker-compose.yml

```bash
# Перезапуск PostgreSQL
docker compose restart postgres
```

### Проблема: "permission denied: ./reset_database.sh"

```bash
chmod +x backend/reset_database.sh
```

## 📝 Переменные окружения

### Обязательные (без них не запустится):
- `DATABASE_URL` - подключение к PostgreSQL
- `SECRET_KEY` - секретный ключ для JWT
- `BOT_TOKEN` - токен Telegram бота
- `BOT_USERNAME` - имя бота

### Важные для production:
- `BOT_WEBHOOK_URL` - URL для Telegram webhook
- `CORS_ALLOW_ORIGINS` - разрешенные домены

### Опциональные (имеют значения по умолчанию):
- `DEBUG` - режим отладки (default: false)
- `STUN_SERVERS` - STUN серверы (default: stun.l.google.com:19302)
- `TURN_SERVERS` - TURN серверы (опционально)
- `MAX_PARTICIPANTS_PER_CALL` - макс. участников (default: 30)
- `MAX_ACTIVE_CALLS_PER_USER` - макс. звонков на пользователя (default: 5)
- `MAX_CALL_DURATION_HOURS` - макс. длительность (default: 12)

Полный список см. в `backend/.env.selectel.example`

## 🎯 Порядок действий при первом развертывании

1. Создать `backend/.env` с обязательными переменными
2. Запустить PostgreSQL: `docker compose up -d postgres`
3. Подождать 5-10 секунд, пока PostgreSQL запустится
4. Запустить скрипт сброса: `./backend/reset_database.sh`
5. Запустить все сервисы: `docker compose up -d`
6. Проверить логи: `docker compose logs -f backend`

## 📚 Дополнительная информация

- Модели БД: `backend/app/models/`
- Конфигурация: `backend/app/config/settings.py`
- Database: `backend/app/config/database.py`

## 🆘 Поддержка

Если возникли проблемы:
1. Проверьте логи: `docker compose logs backend`
2. Проверьте подключение к БД: `docker compose exec postgres psql -U app -d app`
3. Проверьте переменные окружения в `backend/.env`
