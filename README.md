# VideoHarvester — монорепозиторий

Скелет проекта на основе утверждённого ТЗ. Эта версия включает:

- backend (Node/Express/Mongoose/Bull): API эндпоинты, очереди, заглушка уникализации (501), страны (ru) через Intl, YouTube интеграция.
- workers: youtube/tiktok/instagram — обработчики очередей. YouTube: тренды/поиск + скачивание (yt-dlp). TikTok/Instagram: интеграция через сайдкары (плейсхолдеры, возвращают примеры).
- frontend (React + Vite + MUI + Zustand): 3 колонки (YouTube, TikTok, Instagram), режимы «Тренды/Поиск», кнопки «Удалить», «Отправить на уникализацию», общий блок «Уникализированные видео» (заглушка).
- scrapers (Python sidecars): tiktok/instagram — FastAPI плейсхолдеры с эндпоинтами `/trends`, `/search`.
- docker-compose без S3/MinIO.

## Быстрый старт (Docker Compose — DEV)

1. Подготовьте env переменные (YouTube по желанию на этом этапе):
   - `YOUTUBE_API_KEY` — опционально (можно пустым, YouTube просто вернёт ошибки при обращении).
2. Запуск в режиме разработки (горячая перезагрузка для api, workers, web):
   ```sh
   docker compose up
   ```
3. Открыть фронтенд: `http://localhost:5173`
4. API: `http://localhost:8080/health`
5. Примечание: TikTok/Instagram пока выдают примерные данные (sidecar-плейсхолдеры). Backend и воркеры работают в dev-режиме через ts-node-dev, фронтенд — через Vite dev server.

## API (основное)

- POST `/tasks/create/:platform` — создать задачу поиска/трендов.
- GET `/tasks/:platform/:taskId` — статус и результаты задачи.
- GET `/videos/:platform/:videoId/download` — скачивание файла.
- DELETE `/videos/:platform/:videoId` — мягкое удаление (`deleted=true`).
- POST `/videos/:platform/:videoId/unique` — заглушка (501 Not Implemented).
- GET `/meta/countries` — список стран (ru) + «Глобально».

## Замечания

- Уникализация не реализована; см. `readme_unique.md`.
- Интеграции YouTube/TikTok/Instagram пока не подключены (воркеры завершают задачи без результатов).
- Скачивание через `yt-dlp` будет добавлено на шаге интеграции (план в `docs/VideoHarvester_TZ.md`).
