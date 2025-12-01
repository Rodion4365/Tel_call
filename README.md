# Tel Call

Базовая структура монорепозитория для разработки сервиса аудио/видео-звонков.

## Архитектура каталога
- `backend/` — Python FastAPI сервис с минимальным health-check endpoint'ом и Dockerfile.
- `frontend/` — React + TypeScript (Vite) приложение со стартовым экраном и Dockerfile.
- `infra/` — инфраструктурные файлы (docker-compose шаблон, будущие настройки БД, TURN/STUN и т.п.).
- `.github/workflows/` — CI-пайплайн GitHub Actions.

## Быстрый старт
### Backend
1. `cd backend`
2. `python -m venv .venv && source .venv/bin/activate`
3. `pip install -r requirements.txt`
4. `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

### Docker Compose
В каталоге `infra/` находится шаблон `docker-compose.yml`. Перед запуском убедитесь, что
Dockerfile'ы находятся по ожидаемым путям (`../backend` и `../frontend`). При необходимости
добавьте переменные среды для БД, TURN/STUN серверов и т.д.

## CI
`/.github/workflows/ci.yml` запускает базовые проверки: сборку Python-зависимостей и компиляцию
исходников, а также установку npm-зависимостей и сборку фронтенда. Расширяйте пайплайн по мере
добавления тестов и линтеров.
