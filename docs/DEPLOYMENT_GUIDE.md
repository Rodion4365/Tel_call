# 🚀 Руководство по развертыванию Tel Call

Полное руководство по развертыванию проекта Tel Call на сервере (Selectel, VPS, или любой другой).

## 📋 Содержание

- [Требования](#требования)
- [Быстрый старт](#быстрый-старт)
- [Ручная установка](#ручная-установка)
- [Настройка DNS](#настройка-dns)
- [Настройка SSL](#настройка-ssl)
- [Проверка работы](#проверка-работы)
- [Решение проблем](#решение-проблем)

## ✅ Требования

### Сервер

- **ОС**: Ubuntu 20.04+ / Debian 11+
- **RAM**: Минимум 2 GB
- **CPU**: 1+ ядро
- **Диск**: Минимум 10 GB
- **Права**: root или sudo доступ

### Программное обеспечение

- Docker 20.10+
- Docker Compose 2.0+
- Git 2.0+

### Доступ

- SSH доступ к серверу
- Зарегистрированные домены (например: api.callwith.ru, app.callwith.ru)
- Telegram Bot Token (получить от [@BotFather](https://t.me/BotFather))

## 🚀 Быстрый старт (рекомендуется)

### Шаг 1: Подключитесь к серверу

```bash
ssh root@YOUR_SERVER_IP
```

### Шаг 2: Скачайте и запустите скрипт установки

```bash
# Клонируйте репозиторий
git clone https://github.com/Rodion4365/Tel_call.git /tmp/tel_call
cd /tmp/tel_call

# Запустите автоматическую установку
sudo ./scripts/setup.sh
```

Скрипт автоматически:
- ✅ Установит Docker и зависимости
- ✅ Создаст структуру каталогов
- ✅ Создаст конфигурационные файлы
- ✅ Запустит контейнеры

### Шаг 3: Настройте переменные окружения

```bash
cd /opt/app/projects/tel_call

# Отредактируйте backend/.env
nano backend/.env
```

**Обязательно заполните:**

```bash
# Telegram Bot
BOT_TOKEN=ваш_токен_от_BotFather
BOT_USERNAME=ваш_бот_без_@

# Security
SECRET_KEY=сгенерируйте_командой_ниже
```

**Генерация SECRET_KEY:**

```bash
openssl rand -hex 32
```

Отредактируйте `infra/.env`:

```bash
nano infra/.env
```

**Укажите ваши домены:**

```bash
BACKEND_HOST=api.callwith.ru
FRONTEND_HOST=app.callwith.ru
```

### Шаг 4: Перезапустите сервисы

```bash
cd infra
docker compose restart
```

### Шаг 5: Проверьте работу

```bash
# Проверка через localhost
curl -H "Host: api.callwith.ru" http://127.0.0.1/health

# Должно вернуть:
# {"status":"ok"}
```

**Готово!** 🎉

Перейдите к [Настройке DNS](#настройка-dns) для полного запуска.

---

## 🛠️ Ручная установка

Если вы хотите больше контроля над процессом установки.

### 1. Установка зависимостей

```bash
# Обновление системы
apt-get update && apt-get upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Установка Docker Compose
apt-get install docker-compose-plugin -y

# Установка Git
apt-get install git -y
```

### 2. Клонирование репозитория

```bash
mkdir -p /opt/app/projects
cd /opt/app/projects
git clone https://github.com/Rodion4365/Tel_call.git tel_call
cd tel_call
```

### 3. Создание конфигурационных файлов

**backend/.env:**

```bash
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
```

**infra/.env:**

```bash
cat > infra/.env <<'EOF'
# Hostnames
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
```

### 4. Создание директорий для Traefik

```bash
mkdir -p infra/traefik/dynamic
mkdir -p infra/traefik/certs
```

### 5. Запуск контейнеров

```bash
cd infra
docker compose up -d --build
```

### 6. Проверка логов

```bash
docker compose logs -f
```

---

## 🌐 Настройка DNS

Добавьте A записи в DNS провайдере:

| Тип | Имя | Значение |
|-----|-----|----------|
| A | api.callwith.ru | IP_вашего_сервера |
| A | app.callwith.ru | IP_вашего_сервера |

**Проверка DNS:**

```bash
# Должен вернуть IP вашего сервера
dig +short api.callwith.ru
dig +short app.callwith.ru
```

**Или через ping:**

```bash
ping -c 1 api.callwith.ru
```

---

## 🔒 Настройка SSL (Let's Encrypt)

### Вариант 1: Автоматический (рекомендуется)

Traefik может автоматически получать сертификаты от Let's Encrypt.

**Обновите `infra/docker-compose.yml`:**

```yaml
reverse-proxy:
  image: traefik:v2.10
  command:
    # ... существующие команды ...
    - --certificatesresolvers.letsencrypt.acme.email=your-email@example.com
    - --certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
    - --certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
  volumes:
    # ... существующие volumes ...
    - ./letsencrypt:/letsencrypt
```

**Обновите labels для backend:**

```yaml
backend:
  labels:
    - traefik.http.routers.backend.tls.certresolver=letsencrypt
```

**Создайте директорию:**

```bash
mkdir -p infra/letsencrypt
chmod 600 infra/letsencrypt
```

**Перезапустите:**

```bash
docker compose restart
```

### Вариант 2: Ручной

Если у вас уже есть сертификаты:

```bash
# Скопируйте сертификаты
cp your-cert.crt infra/traefik/certs/
cp your-key.key infra/traefik/certs/

# Создайте конфигурацию Traefik
cat > infra/traefik/dynamic/certs.yml <<'EOF'
tls:
  certificates:
    - certFile: /certs/your-cert.crt
      keyFile: /certs/your-key.key
EOF

docker compose restart
```

---

## ✅ Проверка работы

### 1. Проверка контейнеров

```bash
cd /opt/app/projects/tel_call/infra
docker compose ps
```

Все контейнеры должны быть в состоянии `Up`.

### 2. Проверка API

```bash
# Локально
curl -H "Host: api.callwith.ru" http://127.0.0.1/health

# Через домен (требуется DNS)
curl https://api.callwith.ru/health

# Должно вернуть:
{"status":"ok"}
```

### 3. Проверка Traefik Dashboard

Откройте в браузере:
```
http://YOUR_SERVER_IP:8080/dashboard/
```

Вы должны увидеть роутеры:
- `backend` → `api.callwith.ru`
- `frontend` → `app.callwith.ru`

### 4. Проверка Telegram Webhook

```bash
cd /opt/app/projects/tel_call
docker compose run --rm backend python update_webhook.py
```

Должно вывести:
```
✅ Webhook успешно обновлен!
```

### 5. Проверка логов

```bash
# Все логи
docker compose logs -f

# Только backend
docker compose logs -f backend

# Только Traefik
docker compose logs -f reverse-proxy
```

---

## 🐛 Решение проблем

### Проблема: 404 Not Found

**Симптом:**
```bash
curl -H "Host: api.callwith.ru" http://127.0.0.1/health
404 page not found
```

**Причина:** Traefik не видит backend контейнер.

**Решение:**

1. Проверьте что backend запущен:
   ```bash
   docker compose ps backend
   ```

2. Проверьте сеть:
   ```bash
   docker network inspect infra_web
   ```
   Backend должен быть в списке.

3. Проверьте labels:
   ```bash
   docker inspect infra-backend-1 | grep traefik
   ```

4. Проверьте Traefik dashboard:
   http://YOUR_SERVER_IP:8080/dashboard/

5. Перезапустите:
   ```bash
   docker compose down
   docker compose up -d
   ```

### Проблема: Backend не запускается

**Симптом:**
```bash
docker compose ps
# backend: Exit 1
```

**Решение:**

1. Проверьте логи:
   ```bash
   docker compose logs backend
   ```

2. Проверьте .env файлы:
   ```bash
   cat backend/.env
   cat infra/.env
   ```

3. Проверьте базу данных:
   ```bash
   docker compose exec postgres psql -U app -d app -c "SELECT 1;"
   ```

### Проблема: SSL ошибки

**Симптом:**
```
SSL: CERTIFICATE_VERIFY_FAILED
```

**Решение:**

1. Проверьте DNS:
   ```bash
   dig +short api.callwith.ru
   ```

2. Проверьте сертификаты:
   ```bash
   ls -la infra/letsencrypt/
   ```

3. Проверьте Traefik логи:
   ```bash
   docker compose logs reverse-proxy | grep acme
   ```

### Проблема: Docker API версия

**Симптом:**
```
client version 1.24 is too old. Minimum supported API version is 1.44
```

**Решение:**

1. Остановите docker.socket:
   ```bash
   systemctl stop docker.socket
   systemctl disable docker.socket
   ```

2. Перезапустите Docker:
   ```bash
   systemctl restart docker
   ```

3. Проверьте версию API:
   ```bash
   docker version
   ```

---

## 🔄 Обновление проекта

### Автоматическое обновление

```bash
cd /opt/app/projects/tel_call
sudo ./scripts/deploy.sh main
```

### Ручное обновление

```bash
cd /opt/app/projects/tel_call
git pull origin main
cd infra
docker compose down
docker compose up -d --build
```

---

## 📊 Мониторинг

### Полезные команды

```bash
# Статус всех контейнеров
docker compose ps

# Использование ресурсов
docker stats

# Логи в реальном времени
docker compose logs -f

# Перезапуск сервиса
docker compose restart backend

# Полная пересборка
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Traefik Dashboard

Всегда доступен на порту 8080:
```
http://YOUR_SERVER_IP:8080/dashboard/
```

---

## 📚 Дополнительные ресурсы

- [CI/CD Setup Guide](./CICD_SETUP.md)
- [SELECTEL Setup Guide](../SELECTEL_SETUP.md)
- [Project Structure](../PROJECT_STRUCTURE_RU.md)
- [Telegram Bot Setup](../backend/TELEGRAM_BOT_SETUP.md)

---

**Вопросы?** Создайте [issue на GitHub](https://github.com/Rodion4365/Tel_call/issues).
