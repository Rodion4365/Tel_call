#!/bin/bash
# Скрипт для настройки environment переменных

echo "=== Настройка Environment переменных для Tel Call ==="
echo ""

# Функция для безопасного чтения пароля
read_secret() {
    local prompt="$1"
    local value=""
    read -p "$prompt" value
    echo "$value"
}

# Переход в директорию проекта
cd /opt/app/projects/tel_call

# ============================================
# 1. BACKEND ENV
# ============================================
echo "=== 1. Настройка Backend (.env) ==="
echo ""

# Проверка существующего файла
if [ -f backend/.env ]; then
    echo "Файл backend/.env уже существует. Создаем резервную копию..."
    cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)
fi

# Запрос обязательных переменных
echo "Введите данные вашего Telegram бота:"
echo ""
read -p "BOT_TOKEN (от @BotFather): " BOT_TOKEN
read -p "BOT_USERNAME (например, my_bot): " BOT_USERNAME

echo ""
echo "Генерация SECRET_KEY..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))" 2>/dev/null || openssl rand -base64 32)

echo ""
read -p "Хотите использовать свой TURN сервер? (y/n): " USE_TURN

if [ "$USE_TURN" = "y" ]; then
    read -p "TURN_SERVERS (например, turns:turn.example.com:5349?transport=tcp): " TURN_SERVERS
else
    TURN_SERVERS=""
fi

# Создание backend/.env
cat > backend/.env <<EOF
# =====================================================
# BACKEND CONFIGURATION
# =====================================================

# === ОБЯЗАТЕЛЬНЫЕ ПЕРЕМЕННЫЕ ===

# База данных (для Docker используйте имя сервиса 'postgres')
DATABASE_URL=postgresql+asyncpg://app:apppassword@postgres:5432/app

# Секретный ключ (сгенерирован автоматически)
SECRET_KEY=${SECRET_KEY}

# Telegram Bot
BOT_TOKEN=${BOT_TOKEN}
BOT_USERNAME=${BOT_USERNAME}

# Webhook URL
BOT_WEBHOOK_URL=https://api.callwith.ru/api/telegram/webhook

# CORS
CORS_ALLOW_ORIGINS=https://app.callwith.ru

# === ОПЦИОНАЛЬНЫЕ ПЕРЕМЕННЫЕ ===

APP_NAME=Tel Call Backend
DEBUG=false
ACCESS_TOKEN_EXPIRE_MINUTES=43200  # 30 days for Telegram MiniApp

# WebRTC
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVERS=${TURN_SERVERS}

# Лимиты
MAX_PARTICIPANTS_PER_CALL=30
MAX_ACTIVE_CALLS_PER_USER=5
MAX_CALL_DURATION_HOURS=12
MAX_WEBSOCKET_MESSAGE_SIZE=1048576
EMPTY_ROOM_CLEANUP_MINUTES=5
EOF

echo "✅ Файл backend/.env создан!"
echo ""

# ============================================
# 2. INFRASTRUCTURE ENV
# ============================================
echo "=== 2. Настройка Infrastructure (.env) ==="
echo ""

# Проверка существующего файла
if [ -f infra/.env ]; then
    echo "Файл infra/.env уже существует. Создаем резервную копию..."
    cp infra/.env infra/.env.backup.$(date +%Y%m%d_%H%M%S)
fi

read -p "PostgreSQL password (или Enter для использования 'apppassword'): " POSTGRES_PASSWORD
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-apppassword}

# Создание infra/.env
cat > infra/.env <<EOF
# =====================================================
# INFRASTRUCTURE CONFIGURATION
# =====================================================

# Домены
BACKEND_HOST=api.callwith.ru
FRONTEND_HOST=app.callwith.ru

# PostgreSQL
POSTGRES_USER=app
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=app

# WebRTC
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVERS=${TURN_SERVERS}

# TURN Server (опционально)
TURN_REALM=callwith.ru
TURN_SERVER_NAME=turn.callwith.ru
TURN_USERNAME=turnuser
TURN_PASSWORD=turnpassword
TURN_EXTRA_OPTS=
EOF

echo "✅ Файл infra/.env создан!"
echo ""

# ============================================
# 3. СВОДКА
# ============================================
echo "=== ✅ Environment переменные настроены ==="
echo ""
echo "Создано:"
echo "  - backend/.env"
echo "  - infra/.env"
echo ""
echo "Важные значения:"
echo "  BOT_TOKEN: ${BOT_TOKEN:0:10}..."
echo "  BOT_USERNAME: ${BOT_USERNAME}"
echo "  SECRET_KEY: ${SECRET_KEY:0:10}... (сгенерирован автоматически)"
echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}"
echo ""

# ============================================
# 4. ПРИМЕНЕНИЕ ИЗМЕНЕНИЙ
# ============================================
echo "=== Применение изменений ==="
echo ""
read -p "Перезапустить сервисы сейчас? (y/n): " RESTART

if [ "$RESTART" = "y" ]; then
    cd infra
    echo "Перезапуск сервисов..."
    docker compose up -d

    echo ""
    echo "Ожидание запуска сервисов..."
    sleep 5

    echo ""
    echo "=== Проверка работоспособности ==="
    echo ""

    echo "Backend health check:"
    curl -s http://127.0.0.1:8000/health
    echo ""

    echo ""
    echo "Webhook info:"
    curl -s http://127.0.0.1:8000/api/telegram/webhook-info | python3 -m json.tool 2>/dev/null || curl -s http://127.0.0.1:8000/api/telegram/webhook-info
    echo ""
fi

echo ""
echo "=== ✅ Готово! ==="
echo ""
echo "Следующие шаги:"
echo "1. Настройте DNS A-записи для api.callwith.ru и app.callwith.ru"
echo "2. В @BotFather создайте MiniApp с URL: http://app.callwith.ru"
echo "3. После настройки DNS включите HTTPS (см. DEPLOY_INSTRUCTIONS.md)"
