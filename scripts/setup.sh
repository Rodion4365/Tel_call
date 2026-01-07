#!/bin/bash
#
# Скрипт первой установки Tel Call на сервер
# Использование: ./setup.sh
#

set -e

echo "🚀 Tel Call - Первая установка"
echo "================================"
echo ""

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
   echo "❌ Пожалуйста, запустите скрипт от root (sudo ./setup.sh)"
   exit 1
fi

# Проверка что запущено из корня репозитория
if [ ! -f "scripts/setup.sh" ]; then
    echo "❌ Запустите скрипт из корня репозитория: ./scripts/setup.sh"
    exit 1
fi

# Переменные
PROJECT_DIR="/opt/app/projects"
APP_DIR="$PROJECT_DIR/tel_call"
REPO_URL="https://github.com/Rodion4365/Tel_call.git"
BRANCH="main"

echo "📦 Шаг 1/6: Установка зависимостей"
apt-get update -qq
apt-get install -y git docker.io docker-compose curl

echo ""
echo "🐳 Шаг 2/6: Настройка Docker"
systemctl enable docker
systemctl start docker
usermod -aG docker $SUDO_USER || true

echo ""
echo "📁 Шаг 3/6: Создание директории проекта"
mkdir -p "$PROJECT_DIR"

# Удалить старую установку если есть
if [ -d "$APP_DIR" ]; then
    echo "⚠️  Обнаружена старая установка в $APP_DIR"
    read -p "Удалить её? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$APP_DIR/infra" && docker compose down --volumes 2>/dev/null || true
        cd /
        rm -rf "$APP_DIR"
        echo "✅ Старая установка удалена"
    else
        echo "❌ Установка отменена"
        exit 1
    fi
fi

echo ""
echo "📥 Шаг 4/6: Клонирование репозитория"
cd "$PROJECT_DIR"
git clone "$REPO_URL" tel_call
cd tel_call
git checkout "$BRANCH"

echo ""
echo "📝 Шаг 5/6: Создание конфигурационных файлов"

# Создание backend/.env
if [ ! -f backend/.env ]; then
    echo "Создание backend/.env..."
    cat > backend/.env <<'EOF'
# Application
APP_NAME=Tel Call Backend
DEBUG=false

# Database
DATABASE_URL=postgresql+asyncpg://app:apppassword@postgres:5432/app

# Telegram Bot (ЗАПОЛНИТЕ!)
BOT_TOKEN=YOUR_BOT_TOKEN_HERE
BOT_USERNAME=YOUR_BOT_USERNAME_HERE
BOT_WEBHOOK_URL=https://api.callwith.ru/api/telegram/webhook

# Security (ЗАПОЛНИТЕ!)
SECRET_KEY=YOUR_SECRET_KEY_HERE_MIN_32_CHARS
ACCESS_TOKEN_EXPIRE_MINUTES=15

# CORS
CORS_ALLOW_ORIGINS=https://app.callwith.ru

# WebRTC
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVERS=
EOF
    echo "✅ backend/.env создан"
    echo "⚠️  ВАЖНО: Отредактируйте backend/.env и заполните BOT_TOKEN, BOT_USERNAME, SECRET_KEY"
else
    echo "✅ backend/.env уже существует"
fi

# Создание infra/.env
if [ ! -f infra/.env ]; then
    echo "Создание infra/.env..."
    cat > infra/.env <<'EOF'
# Hostnames (ЗАПОЛНИТЕ!)
BACKEND_HOST=api.callwith.ru
FRONTEND_HOST=app.callwith.ru

# PostgreSQL
POSTGRES_USER=app
POSTGRES_PASSWORD=apppassword
POSTGRES_DB=app

# WebRTC
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVERS=

# TURN Server
TURN_REALM=callwith.ru
TURN_SERVER_NAME=turn.callwith.ru
TURN_USERNAME=telcall
TURN_PASSWORD=change_me_in_production
TURN_EXTRA_OPTS=
EOF
    echo "✅ infra/.env создан"
    echo "⚠️  ВАЖНО: Отредактируйте infra/.env и укажите ваши домены"
else
    echo "✅ infra/.env уже существует"
fi

# Создание директорий для Traefik
mkdir -p infra/traefik/dynamic
mkdir -p infra/traefik/certs

echo ""
echo "🚢 Шаг 6/6: Запуск контейнеров"
cd infra
docker compose up -d --build

echo ""
echo "✅ Установка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Отредактируйте $APP_DIR/backend/.env"
echo "   - Укажите BOT_TOKEN (получите от @BotFather)"
echo "   - Укажите BOT_USERNAME (имя бота без @)"
echo "   - Сгенерируйте SECRET_KEY: openssl rand -hex 32"
echo ""
echo "2. Отредактируйте $APP_DIR/infra/.env"
echo "   - Укажите ваши домены BACKEND_HOST и FRONTEND_HOST"
echo ""
echo "3. Настройте DNS записи:"
echo "   - A запись для api.callwith.ru → IP сервера"
echo "   - A запись для app.callwith.ru → IP сервера"
echo ""
echo "4. Перезапустите контейнеры:"
echo "   cd $APP_DIR/infra && docker compose restart"
echo ""
echo "5. Проверьте логи:"
echo "   docker compose logs -f"
echo ""
echo "6. Проверьте работу API:"
echo "   curl -H 'Host: api.callwith.ru' http://127.0.0.1/health"
echo ""
echo "7. Откройте Traefik dashboard:"
echo "   http://$(hostname -I | awk '{print $1}'):8080/dashboard/"
echo ""
