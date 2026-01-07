#!/bin/bash
# Скрипт для обновления backend/.env с HTTP на HTTPS

echo "=== Обновление backend/.env для HTTPS ==="
echo ""

# Переход в директорию проекта
cd /opt/app/projects/tel_call

# Проверка существования файла
if [ ! -f backend/.env ]; then
    echo "❌ Ошибка: файл backend/.env не найден!"
    echo "Запустите сначала setup_env.sh для создания файла."
    exit 1
fi

# Создание резервной копии
echo "Создание резервной копии..."
cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)

# Замена HTTP на HTTPS в URL
echo "Обновление URL с HTTP на HTTPS..."
sed -i 's|BOT_WEBHOOK_URL=http://|BOT_WEBHOOK_URL=https://|g' backend/.env
sed -i 's|CORS_ALLOW_ORIGINS=http://|CORS_ALLOW_ORIGINS=https://|g' backend/.env

echo ""
echo "✅ Файл обновлен!"
echo ""
echo "Проверка изменений:"
grep -E "(BOT_WEBHOOK_URL|CORS_ALLOW_ORIGINS)" backend/.env

echo ""
echo "=== Перезапуск backend сервиса ==="
cd infra
docker compose restart backend

echo ""
echo "Ожидание запуска backend..."
sleep 5

echo ""
echo "=== Проверка работоспособности ==="
echo ""

echo "Health check:"
curl -s https://api.callwith.ru/health
echo ""

echo ""
echo "Webhook info:"
curl -s https://api.callwith.ru/api/telegram/webhook-info
echo ""

echo ""
echo "✅ Готово!"
