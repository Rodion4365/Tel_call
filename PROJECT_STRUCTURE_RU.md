# 📱 Tel Call - Полная документация проекта

> **WebRTC видео/аудио звонки в Telegram Mini App**
> Дата создания: 2025-12-13 | Версия: 2.0

---

## 📖 Оглавление

1. [Краткое описание](#краткое-описание)
2. [Архитектура проекта](#архитектура-проекта)
3. [Структура директорий](#структура-директорий)
4. [Технологический стек](#технологический-стек)
5. [Основные компоненты](#основные-компоненты)
6. [Ключевые функции](#ключевые-функции)
7. [База данных](#база-данных)
8. [API Endpoints](#api-endpoints)
9. [WebRTC & Сигнализация](#webrtc--сигнализация)
10. [Безопасность](#безопасность)
11. [Где что править](#где-что-править)
12. [Развертывание](#развертывание)

---

## 📝 Краткое описание

**Tel Call** - это полнофункциональное приложение для видео/аудио звонков, интегрированное в Telegram как Mini App. Приложение использует WebRTC для peer-to-peer соединений с mesh-топологией.

### Ключевые возможности:
- ✅ Аудио/видео звонки через WebRTC
- ✅ Авторизация через Telegram (без пароля!)
- ✅ Автоматическое создание списка друзей
- ✅ Прямые звонки друзьям с уведомлениями
- ✅ Поддержка STUN/TURN серверов (работает за NAT)
- ✅ Адаптивный UI для мобильных устройств
- ✅ Мультиязычность (русский/английский)
- ✅ Встроенная защита от DDoS (rate limiting)

---

## 🏗️ Архитектура проекта

```
┌─────────────────────────────────────────────────────────────┐
│                      Telegram App                           │
│  (открывает Mini App в WebView/iframe)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Frontend (React + Vite)                    │
│  • Telegram SDK интеграция                                  │
│  • WebRTC клиент (PeerConnection)                           │
│  • UI/UX компоненты                                         │
└────────────┬────────────────────────┬───────────────────────┘
             │                        │
             │ HTTPS REST             │ WebSocket (WSS)
             │                        │
┌────────────▼────────────────────────▼───────────────────────┐
│              Backend (FastAPI + Python)                     │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  HTTP API        │  │  WebSocket       │                │
│  │  • /auth         │  │  Signaling       │                │
│  │  • /calls        │  │  • Offer/Answer  │                │
│  │  • /friends      │  │  • ICE exchange  │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  Auth Service    │  │  CallRoom        │                │
│  │  • JWT tokens    │  │  Manager         │                │
│  │  • Telegram      │  │  (in-memory)     │                │
│  │    validation    │  │                  │                │
│  └──────────────────┘  └──────────────────┘                │
└────────────┬────────────────────────────────────────────────┘
             │
             │ SQL (asyncpg)
             ▼
┌─────────────────────────────────────────────────────────────┐
│                PostgreSQL Database                          │
│  • users, calls, participants, friend_links, call_stats     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure                            │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐          │
│  │  Traefik   │  │   Coturn   │  │  Telegram    │          │
│  │  (Proxy)   │  │   (TURN)   │  │  Bot API     │          │
│  │  HTTPS/WSS │  │  NAT       │  │  (Push       │          │
│  │            │  │  Traversal │  │  Notif.)     │          │
│  └────────────┘  └────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────┘

                WebRTC Media (P2P)
┌──────────┐ ◄────────────────────────────► ┌──────────┐
│  User A  │         (direct)                │  User B  │
└──────────┘                                 └──────────┘
```

**Важно:**
- HTTP/WebSocket для сигнализации (координация)
- WebRTC для медиа-потоков (напрямую между пользователями)
- TURN сервер используется ТОЛЬКО если прямое соединение невозможно

---

## 📁 Структура директорий

```
Tel_call/
│
├── backend/                      # Python FastAPI бэкенд
│   ├── alembic/                  # Миграции базы данных
│   │   └── versions/             # 8 миграционных файлов
│   ├── app/
│   │   ├── api/                  # HTTP & WebSocket endpoints
│   │   │   ├── auth.py           # Telegram OAuth, JWT
│   │   │   ├── calls.py          # CRUD для звонков
│   │   │   ├── signaling.py      # WebSocket signaling
│   │   │   ├── friends.py        # Список друзей
│   │   │   ├── call_stats.py     # Метрики качества звонков
│   │   │   ├── config.py         # WebRTC config (STUN/TURN)
│   │   │   └── telegram_webhook.py # Telegram bot webhook
│   │   ├── config/
│   │   │   ├── settings.py       # Env variables, конфиг
│   │   │   ├── database.py       # SQLAlchemy async setup
│   │   │   └── logging.py        # Структурированные логи
│   │   ├── models/               # SQLAlchemy ORM модели
│   │   │   ├── user.py           # Таблица users
│   │   │   ├── call.py           # Таблица calls
│   │   │   ├── participant.py    # Таблица participants
│   │   │   ├── friend_link.py    # Таблица friend_links
│   │   │   └── call_stats.py     # Таблица call_stats
│   │   ├── services/             # Бизнес-логика
│   │   │   ├── auth.py           # JWT, Telegram validation
│   │   │   ├── signaling.py      # CallRoom, CallRoomManager
│   │   │   ├── telegram_bot.py   # Отправка уведомлений
│   │   │   └── turn_healthcheck.py # Проверка TURN серверов
│   │   └── main.py               # FastAPI app entrypoint
│   ├── tests/                    # Unit & integration тесты
│   ├── .env.example              # Пример переменных окружения
│   ├── requirements.txt          # Python зависимости
│   └── Dockerfile                # Backend container
│
├── frontend/                     # React + TypeScript
│   ├── src/
│   │   ├── assets/               # Картинки, SVG, звуки
│   │   ├── components/           # Переиспользуемые компоненты
│   │   │   ├── ui/               # UI kit (Switch, кнопки)
│   │   │   ├── ConnectionBanner.tsx  # Статус подключения
│   │   │   ├── MobileFrame.tsx   # Обертка для мобильного вида
│   │   │   └── TopBar.tsx        # Верхняя панель навигации
│   │   ├── contexts/             # React Context API
│   │   │   ├── AuthContext.tsx   # Состояние авторизации
│   │   │   ├── NavigationContext.tsx # Навигация
│   │   │   └── WebAppConnectionContext.tsx # Telegram WebApp
│   │   ├── hooks/                # Custom React hooks
│   │   │   ├── useTelegramWebApp.ts
│   │   │   ├── useTelegramBackButton.ts
│   │   │   ├── useTelegramTheme.ts
│   │   │   └── useWebSocketToken.ts
│   │   ├── i18n/                 # Интернационализация
│   │   │   ├── i18n.ts           # i18next setup
│   │   │   └── locales/
│   │   │       ├── en.json       # Английский
│   │   │       └── ru.json       # Русский
│   │   ├── pages/                # Страницы приложения
│   │   │   ├── MainPage.tsx      # Главная (создать/присоединиться)
│   │   │   ├── CallPage.tsx      # Активный звонок (1737 строк!)
│   │   │   ├── CallCreated.tsx   # После создания звонка
│   │   │   ├── CallEndedPage.tsx # Завершение звонка
│   │   │   ├── JoinCallPage.tsx  # Ввод кода звонка
│   │   │   ├── FriendsPage.tsx   # Список друзей
│   │   │   ├── SettingsPage.tsx  # Настройки (язык)
│   │   │   └── TermsPage.tsx     # Условия использования
│   │   ├── services/             # API клиенты
│   │   │   ├── apiClient.ts      # Базовый HTTP клиент
│   │   │   ├── auth.ts           # Auth API
│   │   │   ├── calls.ts          # Calls API
│   │   │   ├── friends.ts        # Friends API
│   │   │   ├── webrtc.ts         # WebRTC config API
│   │   │   └── telegram.ts       # Telegram WebApp SDK
│   │   ├── types/                # TypeScript типы
│   │   ├── utils/                # Утилиты
│   │   ├── webrtc/               # WebRTC клиент (legacy)
│   │   ├── App.tsx               # Root компонент
│   │   ├── main.tsx              # React entrypoint
│   │   └── styles.css            # Global styles
│   ├── public/                   # Статика
│   ├── package.json              # NPM зависимости
│   ├── vite.config.ts            # Vite конфиг
│   └── Dockerfile                # Frontend container
│
├── infra/                        # Infrastructure as Code
│   ├── docker-compose.yml        # Оркестрация сервисов
│   ├── .env.example              # Инфра переменные
│   ├── traefik/                  # Reverse proxy
│   │   ├── dynamic/
│   │   │   └── middlewares.yml   # Security headers
│   │   └── certs/                # TLS сертификаты
│   └── turn/                     # TURN сервер
│       └── certs/                # TURN TLS сертификаты
│
├── SECURITY_AUDIT_REPORT.md      # Отчет по безопасности
├── PROJECT_STRUCTURE_RU.md       # Этот файл
└── README.md                     # Основной README
```

---

## 🛠️ Технологический стек

### Backend
| Технология | Версия | Назначение |
|-----------|--------|-----------|
| **Python** | 3.12+ | Язык программирования |
| **FastAPI** | 0.115+ | Веб-фреймворк (async) |
| **SQLAlchemy** | 2.0+ | ORM (async) |
| **Alembic** | 1.14+ | Миграции БД |
| **PostgreSQL** | 15+ | База данных |
| **aiogram** | 3.15+ | Telegram Bot API |
| **PyJWT** | 2.10+ | JWT токены |
| **SlowAPI** | 0.1+ | Rate limiting |
| **Uvicorn** | 0.34+ | ASGI сервер |

### Frontend
| Технология | Версия | Назначение |
|-----------|--------|-----------|
| **React** | 18.3+ | UI библиотека |
| **TypeScript** | 5.7+ | Типизация |
| **Vite** | 6.0+ | Bundler & dev server |
| **TailwindCSS** | 4.0+ | CSS фреймворк |
| **React Router** | 7.1+ | Маршрутизация |
| **i18next** | 24.0+ | i18n |
| **Framer Motion** | 11.15+ | Анимации |

### Infrastructure
| Технология | Версия | Назначение |
|-----------|--------|-----------|
| **Docker** | 24+ | Контейнеризация |
| **Traefik** | 3.0+ | Reverse proxy + HTTPS |
| **Coturn** | 4.6.3 | TURN сервер |
| **Nginx** | (для прода) | Frontend сервер |

---

## 🧩 Основные компоненты

### 1. Система авторизации (backend/app/services/auth.py)

**Что делает:**
- Проверяет подпись Telegram initData (HMAC-SHA256)
- Создает/обновляет пользователя в БД
- Выдает JWT токен (30 дней)
- Сохраняет токен в httpOnly cookie (защита от XSS)

**Процесс авторизации:**
```
1. Пользователь открывает Telegram Mini App
2. Telegram передает initData (содержит user info + подпись)
3. Frontend отправляет initData → POST /auth/telegram
4. Backend:
   a. Проверяет подпись используя BOT_TOKEN
   b. Проверяет auth_date (не старше 24 часов)
   c. Создает/обновляет пользователя
   d. Генерирует JWT токен
   e. Устанавливает httpOnly cookie
5. Frontend получает токен (также в body для fallback)
6. Все последующие запросы автоматически авторизованы
```

**Где править:**
- **Время жизни токена:** `backend/app/config/settings.py:30-34` (`ACCESS_TOKEN_EXPIRE_MINUTES`)
- **Алгоритм подписи:** `backend/app/services/auth.py:33-49` (функция `_validate_signature`)
- **Логику создания юзера:** `backend/app/services/auth.py:102-165`

---

### 2. Создание звонка (backend/app/api/calls.py)

**Что делает:**
- Создает уникальный call_id (cryptographically secure)
- Сохраняет метаданные звонка в БД
- Генерирует ссылку для присоединения
- Отправляет пуш-уведомление другу (для прямых звонков)

**Важные детали:**
```python
# backend/app/models/call.py:21-28
def generate_call_id() -> str:
    """Генерирует токен длиной 16-20 символов"""
    token = secrets.token_urlsafe(12)  # Криптографически безопасный!
    return token[:20]

# Звонки истекают через 24 часа:
expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=24)
```

**Где править:**
- **Время истечения звонка:** `backend/app/api/calls.py:82` (меняй `hours=24`)
- **Длину call_id:** `backend/app/models/call.py:24-28`
- **Логику создания:** `backend/app/api/calls.py:72-110`

---

### 3. WebRTC Signaling (backend/app/api/signaling.py)

**Что это:**
WebSocket сервер для обмена SDP offer/answer и ICE кандидатами между участниками.

**Как работает:**
```
User A                   Server                    User B
  |                         |                         |
  |-- WS Connect ---------->|                         |
  |<- participants_snapshot-|                         |
  |                         |<-- WS Connect ----------|
  |<- user_joined -----------|--- user_joined ------->|
  |-- SDP offer ----------->|                         |
  |                         |--- relay offer -------->|
  |                         |<-- SDP answer ----------|
  |<- relay answer ---------|                         |
  |-- ICE candidate ------->|--- relay ICE ---------->|
  |<----------------------- DIRECT P2P MEDIA --------|
```

**CallRoom (in-memory хранилище):**
```python
class CallRoom:
    _participants: dict[int, ParticipantConnection]  # user_id -> WebSocket

    async def broadcast(message):
        # Отправляет сообщение всем участникам (кроме отправителя)
```

**⚠️ ВАЖНО:**
- Каждый звонок = 1 CallRoom
- CallRoom существует только пока есть участники
- При отключении последнего участника → room удаляется

**Где править:**
- **WebSocket endpoint:** `backend/app/api/signaling.py:186-394`
- **CallRoom логика:** `backend/app/services/signaling.py:23-127`
- **Broadcast логика:** `backend/app/services/signaling.py:79-127`

---

### 4. Frontend WebRTC (frontend/src/pages/CallPage.tsx)

**⚠️ САМЫЙ СЛОЖНЫЙ ФАЙЛ - 1737 СТРОК!**

**Основные обязанности:**
1. Управление локальным медиа-стримом (микрофон/камера)
2. Создание RTCPeerConnection для каждого участника
3. Обработка WebSocket сообщений (offer/answer/ICE)
4. Отображение удаленных видео-стримов
5. UI состояния (подключение/отключение/ошибки)

**Ключевые части:**

```typescript
// 1. Подключение к WebSocket
const ws = new WebSocket(
  `${wsUrl}/ws/calls/${callId}`,
  ['token', `token.${token}`]  // Токен в subprotocol
);

// 2. Создание PeerConnection для каждого участника
const peer = new RTCPeerConnection({ iceServers });
peer.addTrack(localAudioTrack, localStream);  // Добавляем свой аудио

// 3. Обработка входящего offer
peer.setRemoteDescription(message.payload);
const answer = await peer.createAnswer();
await peer.setLocalDescription(answer);
ws.send({ type: 'answer', to_user_id: from_user.id, payload: answer });

// 4. ICE кандидаты
peer.onicecandidate = (event) => {
  if (event.candidate) {
    ws.send({ type: 'ice_candidate', to_user_id: targetUserId, payload: event.candidate });
  }
};

// 5. Получение удаленного стрима
peer.ontrack = (event) => {
  setParticipants(prev => /* обновляем stream участника */);
};
```

**Где править:**
- **Управление медиа:** `frontend/src/pages/CallPage.tsx:350-500`
- **WebSocket логика:** `frontend/src/pages/CallPage.tsx:1100-1300`
- **Peer connections:** `frontend/src/pages/CallPage.tsx:900-1100`
- **UI состояния:** `frontend/src/pages/CallPage.tsx:1500-1700`

---

### 5. Автоматические друзья (backend/app/api/signaling.py:268-287)

**Как работает:**
```python
# При подключении пользователя к звонку:
1. Получаем всех ДРУГИХ участников этого звонка
2. Создаем ДВУСТОРОННИЕ связи friend_link:
   - user_id=A, friend_id=B
   - user_id=B, friend_id=A
3. Если связь уже существует → обновляем updated_at
```

**Почему двусторонние:**
```sql
-- Быстрый поиск друзей пользователя A:
SELECT * FROM friend_links WHERE user_id = A

-- НЕ нужен JOIN!
-- Если бы была односторонняя, пришлось бы делать:
SELECT * FROM friend_links WHERE user_id = A OR friend_id = A
```

**Где править:**
- **Логика создания:** `backend/app/api/signaling.py:104-151`
- **Когда создаются:** `backend/app/api/signaling.py:268-287`

---

## 🔑 Ключевые функции

### 1. Создание звонка
**Файл:** `backend/app/api/calls.py:72-110`
```
POST /api/calls
Body: { "title": "Название", "is_video_enabled": true }
→ Создает Call в БД
→ Возвращает { "call_id": "abc123", "join_url": "t.me/bot?startapp=abc123" }
```

### 2. Присоединение к звонку
**Файл:** `frontend/src/pages/CallPage.tsx`
```
1. GET /api/calls/{call_id} → проверка что звонок активен
2. GET /auth/ws-token → получение токена для WS
3. WebSocket → /ws/calls/{call_id}
4. Обмен SDP/ICE → установка P2P соединения
```

### 3. Звонок другу
**Файл:** `backend/app/api/calls.py:268-360`
```
POST /api/calls/friend
Body: { "friend_id": 123 }
→ Создает звонок
→ Добавляет участников в БД
→ Отправляет Telegram уведомление
```

### 4. Поиск друзей
**Файл:** `backend/app/api/friends.py:36-118`
```
GET /api/friends?query=john&limit=50&offset=0
→ Ищет по username, first_name, last_name (ILIKE)
→ Сортирует по updated_at DESC (недавние звонки выше)
→ Возвращает список с последним временем звонка
```

---

## 💾 База данных

### Схема таблиц

```sql
-- Пользователи Telegram
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_user_id BIGINT UNIQUE NOT NULL,  -- ID из Telegram
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_telegram_id ON users(telegram_user_id);

-- Звонки
CREATE TABLE calls (
  id SERIAL PRIMARY KEY,
  call_id VARCHAR(20) UNIQUE NOT NULL,  -- Публичный идентификатор
  creator_user_id INT REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  is_video_enabled BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active',  -- active/ended/expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ  -- Обычно created_at + 24 часа
);
CREATE INDEX idx_calls_call_id ON calls(call_id);
CREATE INDEX idx_calls_creator ON calls(creator_user_id);

-- Участники звонков (история)
CREATE TABLE participants (
  id SERIAL PRIMARY KEY,
  call_id INT REFERENCES calls(id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,  -- NULL если еще в звонке
  UNIQUE(call_id, user_id)  -- Один юзер = одна запись на звонок
);
CREATE INDEX idx_participants_call ON participants(call_id);
CREATE INDEX idx_participants_user ON participants(user_id);

-- Друзья (двусторонняя модель)
CREATE TABLE friend_links (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  friend_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),  -- Обновляется при каждом звонке
  PRIMARY KEY (user_id, friend_id)
);
CREATE INDEX idx_friend_links_user ON friend_links(user_id);
CREATE INDEX idx_friend_links_updated ON friend_links(user_id, updated_at DESC);

-- Метрики качества звонков
CREATE TABLE call_stats (
  id SERIAL PRIMARY KEY,
  call_id VARCHAR(20) REFERENCES calls(call_id) ON DELETE CASCADE,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  duration_seconds INT,
  audio_bitrate_kbps FLOAT,
  audio_packets_lost INT,
  audio_jitter_ms FLOAT,
  video_bitrate_kbps FLOAT,
  video_packets_lost INT,
  video_frame_rate FLOAT,
  video_resolution VARCHAR(20),
  rtt_ms FLOAT,  -- Round-trip time
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_call_stats_call ON call_stats(call_id);
```

### Миграции (Alembic)

```bash
# Применить все миграции
cd backend
alembic upgrade head

# Создать новую миграцию
alembic revision --autogenerate -m "описание изменений"

# Откатить на одну миграцию назад
alembic downgrade -1

# Посмотреть текущую версию
alembic current
```

**Существующие миграции:**
1. `9044ba1e3377` - Initial schema (users, calls, participants)
2. `66c9d0e14a53` - Timezone-aware datetimes
3. `3c4d5e6f7g8h` - Friend links bidirectional model
4. `a1b2c3d4e5f6` - Photo URL support
5. `e5f6g7h8i9j0` - Call stats table
6. `f1a2b3c4d5e6` - Performance indexes
7. `g1h2i3j4k5l6` - Cleanup invalid friend links

---

## 🌐 API Endpoints

### Авторизация

#### POST /auth/telegram
**Описание:** Авторизация через Telegram Mini App
**Rate limit:** 5 req/min
**Body:**
```json
{
  "initData": "query_id=...&user={...}&auth_date=...&hash=..."
}
```
**Response:**
```json
{
  "user": {
    "id": 1,
    "telegram_user_id": 123456789,
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe"
  },
  "access_token": "eyJ...",
  "expires_in": 2592000,
  "token_type": "bearer"
}
```
**Cookie:** Устанавливает `access_token` (httpOnly, Secure, SameSite=none)

#### GET /auth/ws-token
**Описание:** Получить токен для WebSocket (из httpOnly cookie)
**Auth:** Required
**Response:**
```json
{
  "token": "eyJ..."
}
```

---

### Звонки

#### POST /api/calls
**Описание:** Создать новый звонок
**Rate limit:** 10 req/min
**Auth:** Required
**Body:**
```json
{
  "title": "Team sync",
  "is_video_enabled": true
}
```
**Response:**
```json
{
  "call_id": "Abc123XyZ456",
  "title": "Team sync",
  "is_video_enabled": true,
  "status": "active",
  "created_at": "2025-12-13T10:30:00Z",
  "expires_at": "2025-12-14T10:30:00Z",
  "join_url": "https://t.me/your_bot?startapp=Abc123XyZ456"
}
```

#### GET /api/calls/{call_id}
**Описание:** Получить информацию о звонке
**Auth:** Required
**Response:** Аналогично POST /api/calls
**Errors:**
- 404 - Звонок не найден / истек / завершен

#### POST /api/calls/{call_id}/end
**Описание:** Завершить звонок (только организатор!)
**Auth:** Required
**Response:** Обновленная информация о звонке
**Errors:**
- 403 - Только организатор может завершить звонок
- 400 - Звонок уже завершен

#### POST /api/calls/join_by_code
**Описание:** Проверить код звонка перед подключением
**Auth:** Required
**Body:**
```json
{
  "call_code": "Abc123XyZ456"
}
```
**Response:** Информация о звонке (как GET /api/calls/{call_id})

#### POST /api/calls/friend
**Описание:** Создать звонок и позвонить другу
**Rate limit:** 10 req/min
**Auth:** Required
**Body:**
```json
{
  "friend_id": 42
}
```
**Response:** Информация о созданном звонке
**Side effects:**
- Создает Participant записи для обоих пользователей
- Отправляет Telegram push уведомление другу

---

### Друзья

#### GET /api/friends
**Описание:** Получить список друзей с поиском
**Auth:** Required
**Query params:**
- `query` (optional) - Поиск по username/first_name/last_name
- `limit` (default: 50, max: 100)
- `offset` (default: 0)
**Response:**
```json
{
  "friends": [
    {
      "id": 42,
      "telegram_user_id": 987654321,
      "username": "alice",
      "first_name": "Alice",
      "last_name": "Smith",
      "photo_url": "https://...",
      "last_call_at": "2025-12-10T15:20:00Z"
    }
  ],
  "total": 15
}
```

#### POST /api/friends/delete
**Описание:** Удалить друга из списка
**Auth:** Required
**Body:**
```json
{
  "friend_id": 42
}
```
**Response:**
```json
{
  "message": "Friend deleted successfully"
}
```

---

### WebRTC Config

#### GET /api/config/webrtc
**Описание:** Получить STUN/TURN серверы для WebRTC
**Auth:** Required
**Response:**
```json
{
  "ice_servers": [
    {
      "urls": "stun:stun.l.google.com:19302"
    },
    {
      "urls": "turns:turn.example.com:5349?transport=tcp",
      "username": "user",
      "credential": "pass"
    }
  ]
}
```

---

### WebSocket

#### WS /ws/calls/{call_id}
**Описание:** WebSocket для сигнализации WebRTC
**Auth:** Токен в `Sec-WebSocket-Protocol: token.{jwt}`

**Входящие сообщения (от клиента):**
```json
// Offer (инициатор создает offer)
{
  "type": "offer",
  "to_user_id": 42,
  "payload": { "type": "offer", "sdp": "v=0..." }
}

// Answer (получатель отвечает)
{
  "type": "answer",
  "to_user_id": 123,
  "payload": { "type": "answer", "sdp": "v=0..." }
}

// ICE candidate
{
  "type": "ice_candidate",
  "to_user_id": 42,
  "payload": { "candidate": "...", "sdpMid": "0", ... }
}
```

**Исходящие сообщения (от сервера):**
```json
// Снимок участников при подключении
{
  "type": "participants_snapshot",
  "participants": [
    { "id": 42, "username": "alice", ... }
  ]
}

// Новый участник присоединился
{
  "type": "user_joined",
  "user": { "id": 99, "username": "bob", ... }
}

// Участник отключился
{
  "type": "user_left",
  "user": { "id": 42, ... }
}

// Релей offer/answer/ICE
{
  "type": "offer",  // или "answer", "ice_candidate"
  "from_user": { "id": 42, ... },
  "payload": { ... }
}

// Звонок завершен организатором
{
  "type": "call_ended",
  "reason": "ended"  // или "expired"
}

// Ошибка
{
  "type": "error",
  "detail": "Target user is offline"
}
```

---

## 🔐 Безопасность

### Реализованные меры

1. **Авторизация:**
   - ✅ HMAC-SHA256 валидация Telegram initData
   - ✅ JWT токены (HS256)
   - ✅ httpOnly cookies (защита от XSS)
   - ✅ Проверка auth_date (не старше 24 часов)

2. **Rate Limiting:**
   - ✅ Глобальный: 100 req/min
   - ✅ Авторизация: 5 req/min
   - ✅ Создание звонка: 10 req/min

3. **CORS:**
   - ✅ Настраиваемые allowed origins
   - ✅ Credentials: true (для cookies)
   - ✅ Preflight cache: 10 минут

4. **HTTPS/WSS:**
   - ✅ Traefik автоматический redirect HTTP → HTTPS
   - ✅ WebSocket только через WSS
   - ✅ TLS сертификаты

5. **Database:**
   - ✅ SQL Injection защита (SQLAlchemy ORM)
   - ✅ Async I/O (не блокирует сервер)
   - ✅ ON DELETE CASCADE (автоочистка)

### ⚠️ Требуют внимания (см. SECURITY_AUDIT_REPORT.md)

- ❌ Нет лимита участников конференции
- ❌ Нет rate limiting на WebSocket
- ❌ Memory leak в CallRoomManager
- ⚠️ Токен в query params (fallback)
- ⚠️ Нет валидации размера WS сообщений
- ⚠️ Нет CSP headers
- ⚠️ Нет максимального времени звонка

---

## 🛠️ Где что править

### Изменить время жизни JWT токена
```python
# backend/app/config/settings.py:30-34
access_token_expire_minutes: int = Field(
    60 * 24 * 30,  # ← Меняй здесь (сейчас 30 дней)
    validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES",
)
```

### Изменить время истечения звонка
```python
# backend/app/api/calls.py:82
expires_at = datetime.now(tz=timezone.utc) + timedelta(hours=24)  # ← Меняй hours=24
```

### Добавить лимит участников
```python
# backend/app/services/signaling.py:37
MAX_PARTICIPANTS = 10  # Добавить константу

async def add_participant(self, user_id: int, websocket: WebSocket, user: dict[str, Any]) -> None:
    async with self._lock:
        if len(self._participants) >= MAX_PARTICIPANTS:  # Добавить проверку
            raise HTTPException(429, "Call is full")
        # ...
```

### Изменить rate limits
```python
# backend/app/main.py:60
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])  # Глобальный

# backend/app/api/auth.py:102
@limiter.limit("5/minute")  # Авторизация

# backend/app/api/calls.py:73, 269
@limiter.limit("10/minute")  # Создание звонка
```

### Добавить новый язык
```bash
# 1. Создать файл
frontend/src/i18n/locales/de.json  # Немецкий

# 2. Скопировать структуру из en.json или ru.json

# 3. Зарегистрировать в i18n
# frontend/src/i18n/i18n.ts
import de from './locales/de.json';

resources: {
  en: { translation: en },
  ru: { translation: ru },
  de: { translation: de },  // ← Добавить
}
```

### Изменить UI цвета участников
```typescript
// frontend/src/pages/CallPage.tsx:51-58
const PARTICIPANT_COLORS = [
  "linear-gradient(135deg, #1d4ed8, #60a5fa)",  // Синий
  "linear-gradient(135deg, #0ea5e9, #38bdf8)",  // Голубой
  // Добавь свои цвета...
];
```

### Добавить новый API endpoint
```python
# 1. Создать в backend/app/api/
# backend/app/api/my_feature.py
from fastapi import APIRouter
router = APIRouter(prefix="/api/my-feature", tags=["MyFeature"])

@router.get("/")
async def get_data():
    return {"status": "ok"}

# 2. Зарегистрировать в backend/app/api/__init__.py
from app.api import my_feature

def get_api_router():
    router = APIRouter()
    router.include_router(my_feature.router)
    return router
```

---

## 🚀 Развертывание

### Локальная разработка

```bash
# 1. Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Отредактировать .env (BOT_TOKEN, DATABASE_URL, SECRET_KEY)
alembic upgrade head
uvicorn app.main:app --reload

# 2. Frontend
cd frontend
npm install
cp .env.example .env
# Отредактировать VITE_API_BASE_URL
npm run dev
```

### Production (Docker Compose)

```bash
# 1. Подготовка
cd infra
cp .env.example .env
# Отредактировать .env (все переменные!)

cd ../backend
cp .env.example .env
# Отредактировать backend/.env

# 2. TLS сертификаты
# Traefik (HTTPS для API/Frontend)
mkdir -p infra/traefik/certs
# Положить tls.crt и tls.key

# TURN сервер
mkdir -p infra/turn/certs
# Положить turn.crt и turn.key

# 3. Запуск
cd infra
docker-compose up -d

# 4. Применить миграции
docker-compose exec backend alembic upgrade head

# 5. Проверка
docker-compose ps
docker-compose logs -f backend
```

### Переменные окружения (Production)

**backend/.env:**
```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@postgres:5432/telcall

# Telegram
BOT_TOKEN=123456:ABCdefGHI...
BOT_USERNAME=your_bot

# Security
SECRET_KEY=генерируй_через_openssl_rand_-hex_32
ACCESS_TOKEN_EXPIRE_MINUTES=43200  # 30 дней

# WebRTC
STUN_SERVERS=stun:stun.l.google.com:19302
TURN_SERVERS=turns:turn.example.com:5349?transport=tcp
TURN_USERNAME=user
TURN_PASSWORD=secure_password

# CORS
CORS_ALLOW_ORIGINS=https://callwith.ru,https://www.callwith.ru

# Настройки
DEBUG=false
```

**infra/.env:**
```bash
# Домены
BACKEND_HOST=api.callwith.ru
FRONTEND_HOST=callwith.ru

# TURN
TURN_REALM=callwith.ru
TURN_SERVER_NAME=turn.callwith.ru
TURN_USERNAME=user
TURN_PASSWORD=secure_password
```

### Мониторинг

```bash
# Логи
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f turn

# Метрики
docker stats

# Health check
curl https://api.callwith.ru/health
```

---

## 📈 Метрики и мониторинг (TODO)

### Рекомендуется добавить:

1. **Prometheus + Grafana**
   - Количество активных звонков
   - Количество участников
   - WebSocket соединения
   - Database connection pool usage
   - HTTP request rate
   - Error rate

2. **Sentry** (error tracking)
   - Ошибки backend
   - Ошибки frontend
   - WebRTC connection failures

3. **Алерты**
   - CPU/Memory > 80%
   - Active calls > 1000
   - Database connection pool exhausted
   - TURN server down

---

## 🧪 Тестирование

```bash
# Backend tests
cd backend
pytest
pytest --cov=app tests/  # С покрытием

# Frontend tests
cd frontend
npm run test
npm run test:coverage
```

---

## 📚 Дополнительные ресурсы

- **WebRTC:** https://webrtc.org/
- **Telegram Mini Apps:** https://core.telegram.org/bots/webapps
- **FastAPI:** https://fastapi.tiangolo.com/
- **React:** https://react.dev/
- **Alembic:** https://alembic.sqlalchemy.org/

---

**Создано:** 2025-12-13
**Версия:** 2.0
**Автор:** Claude Code Agent

> 💡 **Совет:** Начни с чтения SECURITY_AUDIT_REPORT.md для понимания критичных проблем!
