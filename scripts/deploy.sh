#!/bin/bash
#
# Скрипт автоматического развертывания Tel Call
# Использование: ./deploy.sh [branch]
#

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Tel Call - Автоматический деплой${NC}"
echo "===================================="
echo ""

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
   echo -e "${RED}❌ Пожалуйста, запустите скрипт от root (sudo ./deploy.sh)${NC}"
   exit 1
fi

# Переменные
APP_DIR="/opt/app/projects/tel_call"
BRANCH="${1:-main}"
BACKUP_DIR="/opt/app/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Проверка что проект установлен
if [ ! -d "$APP_DIR" ]; then
    echo -e "${RED}❌ Проект не найден в $APP_DIR${NC}"
    echo "Выполните сначала: ./scripts/setup.sh"
    exit 1
fi

cd "$APP_DIR"

echo -e "${YELLOW}📦 Шаг 1/7: Создание бэкапа .env файлов${NC}"
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/env_backup_$TIMESTAMP.tar.gz" backend/.env infra/.env 2>/dev/null || true
echo -e "${GREEN}✅ Бэкап сохранен: $BACKUP_DIR/env_backup_$TIMESTAMP.tar.gz${NC}"

echo ""
echo -e "${YELLOW}🔄 Шаг 2/7: Получение обновлений из Git${NC}"
git fetch origin
echo "Текущая ветка: $(git branch --show-current)"
echo "Переключение на ветку: $BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"
COMMIT_HASH=$(git rev-parse --short HEAD)
echo -e "${GREEN}✅ Обновлено до коммита: $COMMIT_HASH${NC}"

echo ""
echo -e "${YELLOW}📋 Шаг 3/7: Проверка конфигурации${NC}"
if [ ! -f backend/.env ]; then
    echo -e "${RED}❌ Отсутствует backend/.env${NC}"
    exit 1
fi
if [ ! -f infra/.env ]; then
    echo -e "${RED}❌ Отсутствует infra/.env${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Конфигурационные файлы на месте${NC}"

echo ""
echo -e "${YELLOW}🛑 Шаг 4/7: Остановка контейнеров${NC}"
cd infra
docker compose down
echo -e "${GREEN}✅ Контейнеры остановлены${NC}"

echo ""
echo -e "${YELLOW}🏗️  Шаг 5/7: Сборка новых образов${NC}"
docker compose build --no-cache
echo -e "${GREEN}✅ Образы собраны${NC}"

echo ""
echo -e "${YELLOW}🚀 Шаг 6/7: Запуск контейнеров${NC}"
docker compose up -d
echo -e "${GREEN}✅ Контейнеры запущены${NC}"

echo ""
echo -e "${YELLOW}🔍 Шаг 7/7: Проверка работоспособности${NC}"

# Ждем пока backend запустится
echo "Ожидание запуска backend..."
for i in {1..30}; do
    if docker compose exec -T backend curl -f http://localhost:8000/health 2>/dev/null; then
        echo -e "${GREEN}✅ Backend работает${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Backend не запустился за 30 секунд${NC}"
        echo "Проверьте логи: docker compose logs backend"
        exit 1
    fi
    sleep 1
done

# Проверка через Traefik
BACKEND_HOST=$(grep BACKEND_HOST infra/.env | cut -d'=' -f2)
if curl -sf -H "Host: $BACKEND_HOST" http://127.0.0.1/health > /dev/null; then
    echo -e "${GREEN}✅ Traefik routing работает${NC}"
else
    echo -e "${YELLOW}⚠️  Traefik routing не работает (проверьте DNS и сертификаты)${NC}"
fi

echo ""
echo -e "${GREEN}════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Деплой успешно завершен!${NC}"
echo -e "${GREEN}════════════════════════════════════${NC}"
echo ""
echo "📊 Информация о деплое:"
echo "   Ветка: $BRANCH"
echo "   Коммит: $COMMIT_HASH"
echo "   Время: $(date)"
echo ""
echo "📋 Полезные команды:"
echo "   Логи:      cd $APP_DIR/infra && docker compose logs -f"
echo "   Статус:    cd $APP_DIR/infra && docker compose ps"
echo "   Рестарт:   cd $APP_DIR/infra && docker compose restart"
echo "   Dashboard: http://$(hostname -I | awk '{print $1}'):8080/dashboard/"
echo ""
