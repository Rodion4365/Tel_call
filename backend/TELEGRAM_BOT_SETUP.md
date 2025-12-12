# Telegram Bot - Краткое руководство по настройке

## Проблема
Бот не отвечает на команды /start и /help в чате.

## Причина
Telegram не может отправлять обновления (updates) на ваш сервер, потому что **webhook не настроен**.

## Решение

### 1. Получите токен бота
Если у вас еще нет бота:
1. Напишите @BotFather в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям
4. Сохраните полученный токен (например: `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`)

### 2. Настройте переменные окружения
Создайте файл `.env` в директории `/backend/`:

```bash
# Скопируйте пример
cp .env.example .env
```

Отредактируйте `.env` и заполните:
```env
BOT_TOKEN=your_bot_token_here
BOT_USERNAME=your_bot_username
DATABASE_URL=sqlite+aiosqlite:///./app.db
SECRET_KEY=your-secret-key-here
```

### 3. Установите webhook

#### Вариант A: Для продакшена (с доменом)
```bash
# Запустите backend сервер
make run

# В другом терминале установите webhook
make webhook-set WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook

# Или напрямую через Python
python -m app.tasks.set_webhook set https://yourdomain.com/api/telegram/webhook
```

#### Вариант B: Для локальной разработки (с ngrok)
```bash
# 1. Запустите backend сервер
make run

# 2. В другом терминале запустите ngrok
ngrok http 8000

# 3. Скопируйте HTTPS URL из ngrok (например: https://abc123.ngrok.io)

# 4. Установите webhook
make webhook-set WEBHOOK_URL=https://abc123.ngrok.io/api/telegram/webhook
```

### 4. Проверьте статус webhook
```bash
make webhook-info
```

Вы должны увидеть:
```
✅ Current webhook info:
  URL: https://yourdomain.com/api/telegram/webhook
  Pending update count: 0
  Last error message: None
```

### 5. Протестируйте бота
Откройте Telegram и отправьте боту:
- `/start` - должно появиться приветственное сообщение с кнопкой "Открыть приложение"
- `/help` - должно появиться сообщение о поддержке

## Устранение неполадок

### Бот все еще не отвечает
1. Проверьте логи backend:
   ```bash
   # При запуске через make run вы увидите логи в консоли
   ```

2. Проверьте статус webhook:
   ```bash
   make webhook-info
   ```

   Если есть ошибки в `last_error_message`, исправьте их.

3. Убедитесь, что backend запущен и доступен по указанному URL

4. Для ngrok: убедитесь, что ngrok работает и URL совпадает с webhook URL

### Ошибка "SSL certificate verification failed"
Telegram требует валидный SSL сертификат для webhook. Убедитесь:
- Используете HTTPS (не HTTP)
- Сертификат валиден (не самоподписанный для продакшена)
- Для ngrok это работает автоматически

### Как удалить webhook
```bash
make webhook-delete
```

## Доступные команды

### Makefile команды
```bash
make run              # Запустить backend сервер
make webhook-info     # Показать информацию о webhook
make webhook-set      # Установить webhook (требует WEBHOOK_URL)
make webhook-delete   # Удалить webhook
```

### Python команды
```bash
python -m app.tasks.set_webhook set <URL>     # Установить webhook
python -m app.tasks.set_webhook info          # Информация о webhook
python -m app.tasks.set_webhook delete        # Удалить webhook
```

## Архитектура

### Как работает бот
1. Пользователь отправляет команду в Telegram
2. Telegram отправляет update на ваш webhook endpoint
3. FastAPI получает POST запрос на `/api/telegram/webhook`
4. aiogram dispatcher обрабатывает update
5. Соответствующий handler (@dp.message(Command("start"))) вызывается
6. Бот отправляет ответ пользователю

### Файлы бота
- `app/services/bot_handlers.py` - обработчики команд /start и /help
- `app/api/telegram_webhook.py` - webhook endpoint
- `app/tasks/set_webhook.py` - скрипт для настройки webhook
- `app/services/telegram_bot.py` - функции для работы с Telegram API

## Полезные ссылки
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [aiogram Documentation](https://docs.aiogram.dev/)
- [ngrok](https://ngrok.com/)
