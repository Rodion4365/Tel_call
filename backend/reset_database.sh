#!/bin/bash
# Полный сброс базы данных и применение миграций с нуля
# Использовать на новом сервере или когда можно потерять все данные

set -e

echo "🗑️  ПОЛНЫЙ СБРОС БАЗЫ ДАННЫХ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  ВНИМАНИЕ: Все данные будут УДАЛЕНЫ!"
echo "   - Все таблицы будут удалены"
echo "   - История миграций будет сброшена"
echo "   - Все пользователи, звонки, статистика будут потеряны"
echo ""
read -p "Продолжить? Введите 'yes' для подтверждения: " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Отменено"
    exit 0
fi

echo ""
echo "1️⃣  Удаление всех таблиц..."

python3 << 'PYTHON_SCRIPT'
import asyncio
from sqlalchemy import text
from app.config.database import engine

async def drop_all_tables():
    async with engine.begin() as conn:
        print("   Получение списка всех таблиц...")
        result = await conn.execute(text("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
        """))
        tables = [row[0] for row in result.fetchall()]

        if not tables:
            print("   ℹ️  Таблицы не найдены (база уже пустая)")
            return

        print(f"   Найдено таблиц: {len(tables)}")

        # Удаляем все таблицы одной командой с CASCADE
        for table in tables:
            print(f"   Удаление таблицы: {table}")

        await conn.execute(text(f"""
            DROP TABLE IF EXISTS {', '.join(tables)} CASCADE
        """))

        print("   ✅ Все таблицы удалены")

try:
    asyncio.run(drop_all_tables())
except Exception as e:
    print(f"   ❌ Ошибка при удалении таблиц: {e}")
    exit(1)
PYTHON_SCRIPT

echo ""
echo "2️⃣  Применение всех миграций..."
alembic upgrade head

echo ""
echo "3️⃣  Проверка созданных таблиц..."

python3 << 'PYTHON_SCRIPT'
import asyncio
from sqlalchemy import text
from app.config.database import engine

async def check_tables():
    async with engine.begin() as conn:
        result = await conn.execute(text("""
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        """))
        tables = result.fetchall()

        if not tables:
            print("   ❌ Таблицы не созданы!")
            exit(1)

        print("   Созданные таблицы:")
        for table in tables:
            print(f"   ✓ {table[0]}")

try:
    asyncio.run(check_tables())
except Exception as e:
    print(f"   ❌ Ошибка при проверке таблиц: {e}")
    exit(1)
PYTHON_SCRIPT

echo ""
echo "4️⃣  Проверка версии миграций..."
alembic current

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ГОТОВО! База данных сброшена и настроена с нуля"
echo ""
echo "📋 Следующие шаги:"
echo "   1. Убедитесь, что backend/.env настроен правильно"
echo "   2. Запустите бэкенд: docker compose up -d backend"
echo "   3. Проверьте логи: docker compose logs backend"
echo ""
