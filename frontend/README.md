# Frontend

## Stack
- React 18
- TypeScript
- Vite for build/dev server

## Local development
1. Install dependencies: `npm install` (run from the `frontend/` directory).
2. Start dev server: `npm run dev` (defaults to port 5173).
3. Build for production: `npm run build`.

## Notes
- The UI is routed with React Router and integrates with the Telegram WebApp initialization hook.
- Main flows:
  - `/` — главная страница: создание звонка или присоединение к существующему, переход в настройки.
  - `/join-call` — экран подключения к звонку.
  - `/call-created/:call_id` — экран с ссылкой на созданный звонок (поделиться/скопировать/присоединиться).
  - `/call/:id` — страница активного звонка.
