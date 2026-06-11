# Робот ПСА Landing

Продающий лендинг для сервиса автоматического распознавания приемо-сдаточных актов металлоприемок и загрузки проверенных данных в 1С.

## Состав

- `index.html` — структура страницы
- `privacy.html` — политика обработки персональных данных
- `styles.css` — адаптивная визуальная система
- `app.js` — калькулятор экономии и состояние формы
- `assets/hero-psa-1c.jpg`, `assets/hero-psa-1c-mobile.jpg` — hero-изображения
- `ops/serve_static.py` — статический сервер и API `/api/lead`
- `ops/` — серверные скрипты для сертификата и HAProxy
- `docs/operations.md` — эксплуатационная документация

## Продакшен

- Домен: `robotpsa.ru`
- Сервер: `45.10.245.231`, `root@mail.itpr.ru`
- Статика: `/srv/robotpsa/current`
- Сервис: `robotpsa-site.service`, слушает только `127.0.0.1:18080`
- Публичный HTTP: HAProxy `:80` -> redirect на HTTPS для `robotpsa.ru`
- Публичный HTTPS: HAProxy `:443` -> SNI route -> local TLS terminator -> `robotpsa_web80`
- Форма: `POST /api/lead`, локальная очередь заявок на сервере
- Телефон: `+7 495 970-45-89`

HTTPS включен через Let’s Encrypt, certbot и HAProxy. Подробности и команды - в [docs/operations.md](docs/operations.md).
