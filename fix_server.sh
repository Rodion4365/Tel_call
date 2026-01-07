#!/bin/bash
# Скрипт для исправления проблем на сервере

echo "=== 1. Проверка текущего состояния ==="
cd /opt/app/projects/tel_call
git status

echo ""
echo "=== 2. Сохранение и очистка локальных изменений ==="
git stash

echo ""
echo "=== 3. Переключение на правильную ветку ==="
git checkout claude/migrate-selectel-hosting-3WsgT
git pull origin claude/migrate-selectel-hosting-3WsgT --rebase

echo ""
echo "=== 4. Проверка логов frontend ==="
cd infra
docker compose logs --tail=50 frontend

echo ""
echo "=== 5. Проверка файлов внутри frontend контейнера ==="
docker compose exec frontend ls -la /usr/share/nginx/html

echo ""
echo "=== 6. Проверка nginx конфигурации ==="
docker compose exec frontend cat /etc/nginx/conf.d/default.conf

echo ""
echo "=== 7. Перезапуск frontend ==="
docker compose restart frontend

echo ""
echo "=== 8. Финальная проверка ==="
sleep 3
curl -H "Host: app.callwith.ru" http://127.0.0.1
