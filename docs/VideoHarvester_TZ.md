# VideoHarvester — Обновлённое техническое задание

Версия: 1.1 (утверждена)

- Язык интерфейса: русский (десктоп, без мобильной адаптации)
- Производительность (цель): обработка/вывод 10 видео за 5–10 минут
- Развёртывание: локально через Docker Compose
- Уникализация: отдельный этап (в этой версии не реализуется; API-заглушка 501)

## 1. Архитектура и принципы

- Монорепозиторий: `frontend` (React) + `backend` (Node/Express)  + MongoDB + Redis (опц.) Python-сайдкары для TikTok/Instagram трендов.
- Изоляция по платформам: независимые очереди и обработчики для YouTube, TikTok, Instagram. Ошибки одной платформы не влияют на другие.
- Потоки данных:
  1) Пользователь в UI создаёт задачу (поиск по параметрам или «Показать тренды»).
  2) API создаёт Task, ставит job в очередь платформы.
  3) Воркер ищет видео → сохраняет метаданные в БД → при необходимости скачивает.
  4) UI опрашивает статус Task и показывает результаты (превью, метаданные, ссылки на скачивание).
  5) Кнопка «Отправить на уникализацию» вызывает API-заглушку (501 Not Implemented).
  6) Внизу страницы общий блок «Уникализированные видео» (пока пустой/заглушка).

## 2. Технологический стек

- Фронтенд: React, Vite/CRA, Zustand, Material-UI (MUI), Axios, React Router.
- Бэкенд: Node.js (LTS), Express, MongoDB (Mongoose), yt-dlp (скачивание), Winston (логи).
- Интеграции трендов:
  - YouTube: официальный `YouTube Data API v3` (только API Key, без OAuth).
  - TikTok: Python `TikTokApi` (Playwright) или `tiktokapipy` (разрешён Python-сайдкар).
  - Instagram: `instaloader` (Python, CLI/lib) — поиск по хэштегам.
- Инфраструктура: Docker Compose (web, api, worker-*, mongo, tiktok-scraper, instagram-scraper).

## 3. Переменные окружения

- `YOUTUBE_API_KEY` — ключ YouTube (обязательно; строго из env, UI не запрашивает).
- `MONGO_URI` — строка подключения MongoDB.
- `DOWNLOADS_DIR` — директория для скачиваемых файлов (по умолчанию `/downloads`).
- `NODE_ENV`, `LOG_LEVEL` — опционально.
- `POLL_INTERVAL_MS` — интервал поллинга статусов в UI (по умолчанию 2000 мс).

Настройки через API на данном этапе отсутствуют. `downloadsDir` также задаётся через env.

## 4. Функциональные требования

### 4.1. Фронтенд (без авторизации)

- Главный экран: 3 колонки (YouTube, TikTok, Instagram).
- Форма в каждой колонке:
  - Режим A: «Поиск по параметрам» — ключевые слова (опц.), регион (человекочитаемое название на русском), количество (1–10).
  - Режим B: «Показать тренды» — без ключевых слов.
  - Регион по умолчанию: «Глобально»; если API не поддерживает глобально — использовать «США» (US) как дефолт.
  - Селект стран: полный список ISO-стран с русскими названиями (например, `i18n-iso-countries` + ru локаль).
- Результаты в каждой колонке:
  - Таблица: превью, заголовок, автор, метрики (просмотры, лайки, длительность), статус (found/downloading/ready/error), ссылки на скачивание.
  - Действия: «Скачать» (ссылка на API), «Удалить» (помечает в БД `deleted=true`, скрывает из UI).
  - Кнопка «Отправить на уникализацию»: вызывает API-заглушку (ожидаемый ответ 501 Not Implemented с структурой ошибки), UI показывает нотификацию с пояснением.
- Общий блок внизу страницы: «Уникализированные видео» и «Прогресс уникализации» — пока заглушка (пустое состояние с пояснением, будущие статусы).
- Поллинг статусов задач: по умолчанию каждые 2 секунды (можно изменить через env).
- Ошибки: тосты/диалоги с детальными сообщениями (rate limit, API failure, download failed, not implemented).

### 4.2. Бэкенд (API)

- POST `/tasks/create/:platform`
  - `platform ∈ {youtube|tiktok|instagram}`
  - Body:
    ```json
    {
      "mode": "search" | "trends",
      "keywords": "строка?",
      "regionName": "Россия | США | Глобально | ...",
      "count": 1..10
    }
    ```
  - Логика: валидировать вход → создать Task → поставить job в очередь платформы → ответ `{ taskId, platform, status: "queued" }`.

- GET `/tasks/:platform/:taskId`
  - Ответ:
    ```json
    {
      "taskId": "...",
      "platform": "youtube|tiktok|instagram",
      "status": "queued|searching|downloading|completed|error",
      "progress": { "found": n, "downloaded": n, "total": n },
      "videos": [
        {
          "videoId": "platformVideoId",
          "title": "...",
          "author": "...",
          "views": 123,
          "likes": 45,
          "durationSec": 37,
          "previewUrl": "http...",
          "sourceUrl": "http...",
          "downloadPath": "/downloads/.../file.ext?",
          "status": "found|downloading|ready|error",
          "error": "?",
          "deleted": false
        }
      ]
    }
    ```

- GET `/videos/:platform/:videoId/download`
  - Стрим локального файла (404, если видео помечено как `deleted` или файла нет).

- DELETE `/videos/:platform/:videoId`
  - Мягкое удаление: `deleted=true` в БД, файл остаётся на диске.

- POST `/videos/:platform/:videoId/unique`
  - Заглушка уникализации: ответ 501 Not Implemented с телом
    ```json
    { "error": { "code": "NOT_IMPLEMENTED", "message": "Uniqueness is not implemented yet" } }
    ```

Примечание: эндпоинтов `/settings` в этой версии нет — все настройки из env.

### 4.3. Поиск трендов и параметры

- YouTube (официальный API):
  - Режим «Тренды»: `videos.list({ chart: "mostPopular", regionCode })`.
  - Режим «Поиск»: `search.list({ q: keywords, type: "video", regionCode, order: "viewCount" })` + дополнительно `videos.list` для метрик.
  - Превью: `snippet.thumbnails.medium.url`.
  - Глобально: YouTube не поддерживает «весь мир» для `mostPopular`; при выборе «Глобально» использовать «US».

- TikTok (неофициально):
  - Рекомендуется Python `TikTokApi` + Playwright (мобильный UA) для `for_you`/трендов или `tiktokapipy` (async).
  - Доставать: id, author, stats (views/likes), cover (превью), длительность, ссылку на ролик.
  - Учитывать антибот-защиту, тайминги, бэкофф и кэширование.

- Instagram (неофициально):
  - `instaloader` по хэштегам (например, `viralreels`, `trending`).
  - Доставать: shortcode/id, author, лайки/просмотры (если доступны), thumbnail, ссылку.

### 4.4. Скачивание

- Инструмент: `yt-dlp`.
- Схема путей: `DOWNLOADS_DIR/<platform>/<taskId>/<platformVideoId>.<ext>`.
- Цель: скачать исходник без уникализации и без принудительной перекодировки. Если доступно несколько форматов — предпочтительно mp4/h264/aac, но без перекодирования (скачиваем ближайший подходящий вариант, иначе отдаём как есть).

## 5. Модели данных (MongoDB/Mongoose)

- `Task`:
  - `taskId` (string, uuid), `platform` (enum), `mode` (search|trends), `query` ({ keywords?, regionName, regionCode?, count }),
  - `status` (queued|searching|downloading|completed|error), `progress` ({ found, downloaded, total }),
  - `errors[]` (array), `createdAt`, `updatedAt`.

- `Video`:
  - `platform` (enum), `platformVideoId` (string, уникально в паре с `platform`), `taskId` (string),
  - `title`, `author`, `views`, `likes`, `durationSec`, `previewUrl`, `sourceUrl`,
  - `downloadPath` (string), `status` (found|downloading|ready|error), `error?`,
  - `deleted` (bool, default false), `createdAt`, `updatedAt`.
  - Индексы: `{ platform, platformVideoId }` уникальный; `{ taskId }`.


## 7. Логирование и ошибки

- Логи: Winston, уровни `info|warn|error`, JSON, кореляционные поля (`requestId`, `taskId`, `videoId`).
- Контракты ошибок (JSON): `{ error: { code, message, details? } }`.
  - Коды: `RATE_LIMIT`, `API_FAILURE`, `DOWNLOAD_FAILED`, `NOT_FOUND`, `VALIDATION_ERROR`, `NOT_IMPLEMENTED`.

## 8. UX детали

- Полный список стран с русскими названиями; первый пункт — «Глобально».
- Индикаторы статусов и прогресса на уровне задачи и отдельных видео.
- «Удалить» скрывает элемент мгновенно (оптимистично), при ошибке откатываем.
- «Отправить на уникализацию» показывает нотификацию с пояснением (501 Not Implemented на бэке).
- Кнопка «Скачать» неактивна, если файла ещё нет или удалён.

## 10. Развёртывание (Docker Compose)


## 12. Критерии приёмки

- Создание задач на каждую платформу (поиск/тренды), получение статусов, отображение топ-N видео.
- Скачивание файлов работает, ссылки «Скачать» доступны по мере готовности.
- «Удалить» помечает `deleted=true` и скрывает элемент в UI.
- Кнопка «Отправить на уникализацию» вызывает API и получает 501 Not Implemented, UI корректно отображает предупреждение.
- Глобально/США дефолт региона отрабатывает корректно для YouTube.
- Без использования S3/MinIO, настройки берутся из env.

## 13. Риски и допущения

- Неофициальные API (TikTok/Instagram) подвержены частым изменениям и антибот-механизмам; требуется Playwright/тайминги/бэкофф.
- YouTube «весь мир» недоступен для `mostPopular`; используем «US» как разумный дефолт.
- В первой версии не выполняется уникализация; API-заглушка нужна для ранней интеграции UI и тестов ошибок.

