#!/bin/bash
# Скрипт для исправления проблемы с миграциями Alembic
# Использовать ТОЛЬКО на новом пустом сервере!

set -e

echo "🔍 Проверка текущего состояния миграций..."

# Проверяем подключение к БД
echo "📊 Проверка подключения к базе данных..."
python -c "
from app.config.database import engine
import asyncio

async def check_db():
    try:
        async with engine.begin() as conn:
            result = await conn.execute('SELECT 1')
            print('✅ Подключение к БД успешно')
    except Exception as e:
        print(f'❌ Ошибка подключения к БД: {e}')
        exit(1)

asyncio.run(check_db())
" || exit 1

echo ""
echo "🗑️  ВНИМАНИЕ: Этот скрипт сбросит все миграции и создаст БД с нуля!"
echo "❌ НЕ ИСПОЛЬЗУЙТЕ на продакшене с данными!"
echo ""
read -p "Продолжить? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Отменено пользователем"
    exit 0
fi

echo ""
echo "1️⃣  Сброс таблицы alembic_version..."
python -c "
from app.config.database import engine
import asyncio
from sqlalchemy import text

async def reset_alembic():
    async with engine.begin() as conn:
        # Проверяем существование таблицы alembic_version
        result = await conn.execute(text(\"\"\"
            SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_name = 'alembic_version'
            )
        \"\"\"))
        exists = result.scalar()

        if exists:
            print('   Удаление таблицы alembic_version...')
            await conn.execute(text('DROP TABLE alembic_version CASCADE'))
            print('   ✅ Таблица alembic_version удалена')
        else:
            print('   ℹ️  Таблица alembic_version не существует')

asyncio.run(reset_alembic())
"

echo ""
echo "2️⃣  Удаление всех существующих таблиц (если есть)..."
python -c "
from app.config.database import engine, Base
import asyncio
from sqlalchemy import text

async def drop_all():
    async with engine.begin() as conn:
        # Удаляем все таблицы
        await conn.execute(text('DROP TABLE IF EXISTS call_stats CASCADE'))
        await conn.execute(text('DROP TABLE IF EXISTS participants CASCADE'))
        await conn.execute(text('DROP TABLE IF EXISTS friend_links CASCADE'))
        await conn.execute(text('DROP TABLE IF EXISTS calls CASCADE'))
        await conn.execute(text('DROP TABLE IF EXISTS users CASCADE'))
        print('   ✅ Все таблицы удалены')

asyncio.run(drop_all())
"

echo ""
echo "3️⃣  Применение всех миграций с самого начала..."
alembic upgrade head

echo ""
echo "✅ Готово! Миграции успешно применены."
echo ""
echo "📋 Проверка созданных таблиц:"
python -c "
from app.config.database import engine
import asyncio
from sqlalchemy import text

async def list_tables():
    async with engine.begin() as conn:
        result = await conn.execute(text(\"\"\"
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        \"\"\"))
        tables = result.fetchall()

        if tables:
            for table in tables:
                print(f'   ✓ {table[0]}')
        else:
            print('   ❌ Таблицы не найдены!')

asyncio.run(list_tables())
"

echo ""
echo "🎉 Миграции применены успешно!"
