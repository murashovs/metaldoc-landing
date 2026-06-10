# Робот ПСА - эксплуатационная документация

Документ описывает текущий продакшен-лендинг `robotpsa.ru`: где лежит код, как он опубликован, как работает форма, как выпускать сертификат и как откатываться без риска для остальных сервисов на сервере.

## Архитектура

HTTP сейчас делает redirect на HTTPS для основного домена:

```text
visitor -> 45.10.245.231:80 -> HAProxy http_front80
        -> 301 https://robotpsa.ru/
```

HTTPS работает так:

```text
visitor -> 45.10.245.231:443 -> HAProxy https_frontend, TCP/SNI
        -> backend https_robotpsa -> 127.0.0.1:18443
        -> HAProxy local TLS terminator
        -> backend robotpsa_web80 -> 127.0.0.1:18080
```

Такой вариант сохраняет текущий TCP/SNI passthrough для `mail.itpr.ru`, `appserv1c.navika.ru` и `appserv1c1.navika.ru`.

## Репозиторий

- GitHub: `https://github.com/murashovs/metaldoc-landing.git`
- Основная ветка: `main`
- Страница статическая: `index.html`, `styles.css`, `app.js`, `assets/hero-psa-1c.png`
- Операционные скрипты: `ops/`

Проверка JS:

```bash
node --check app.js
```

## Продакшен-сервер

- Хост: `mail.itpr.ru`
- Публичный IP: `45.10.245.231`
- ОС: Ubuntu 24.04 LTS
- HAProxy: 2.8.x
- Сервис сайта: `robotpsa-site.service`
- Статика: `/srv/robotpsa/current`, symlink на `/srv/robotpsa/releases/<timestamp>`
- Python static server: `/opt/robotpsa/serve_static.py`

SSH-ключ для дальнейшего доступа:

```bash
ssh -i /Users/ser/.ssh/codex_robotpsa_root_ed25519 \
  -o IdentitiesOnly=yes \
  root@mail.itpr.ru
```

Fingerprint ключа:

```text
SHA256:vIBmgtU7VI4Kc8DwoFOa1aCQgUAZ6chyEuch00u3Hho
```

Приватный ключ хранится локально и не должен попадать в git, чаты, документы или логи.

## DNS

Для работы домена нужно создать записи:

```text
robotpsa.ru      A      45.10.245.231
www.robotpsa.ru  A      45.10.245.231
```

Вместо `www A` можно использовать `www CNAME robotpsa.ru`, если панель DNS это поддерживает.

Не добавлять AAAA, пока на сервере не настроен IPv6 для сайта.

Проверка:

```bash
dig +short robotpsa.ru A
dig +short www.robotpsa.ru A
dig @a.dns.ripn.net robotpsa.ru NS +short
```

10 июня 2026 домен начал отдавать A-записи на `45.10.245.231`, после чего был выпущен сертификат Let’s Encrypt для `robotpsa.ru` и `www.robotpsa.ru`.

## HTTP-публикация

Сервис сайта слушает только localhost:

```bash
systemctl status robotpsa-site.service
ss -lntp | grep ':18080'
curl -fsSI http://127.0.0.1:18080/
```

HAProxy принимает внешний HTTP и делает redirect на HTTPS, кроме ACME challenge:

```haproxy
acl robotpsa_host_redirect hdr(host) -i robotpsa.ru www.robotpsa.ru robotpsa.ru:80 www.robotpsa.ru:80
acl robotpsa_acme_redirect path_beg /.well-known/acme-challenge/
http-request redirect scheme https code 301 if robotpsa_host_redirect !robotpsa_acme_redirect

acl is_robotpsa hdr(host) -i robotpsa.ru www.robotpsa.ru robotpsa.ru:80 www.robotpsa.ru:80
use_backend robotpsa_web80 if is_robotpsa

backend robotpsa_web80
mode http
option httpchk GET /
http-check expect status 200
server robotpsa 127.0.0.1:18080 check inter 3s rise 2 fall 3
```

Проверка HTTP redirect:

```bash
curl -sSI http://robotpsa.ru/
```

## Форма обратной связи

Форма отправляется через FormSubmit:

- AJAX endpoint: `https://formsubmit.co/ajax/doctormail@yandex.ru`
- HTML fallback action: `https://formsubmit.co/doctormail@yandex.ru`
- Тема письма: `Новая заявка с лендинга Робот ПСА`
- Источник: `robotpsa.ru`

Важно: FormSubmit обычно требует подтверждения адреса при первой заявке. Если письма не приходят, проверить входящие и спам на `doctormail@yandex.ru` и подтвердить FormSubmit.

Fallback `_next` указывает на:

```text
https://robotpsa.ru/?sent=1#demo
```

## Let’s Encrypt и HTTPS

На сервере установлен `certbot`, активен `certbot.timer`.

Установленные скрипты:

- `/opt/robotpsa/issue-letsencrypt.sh`
- `/opt/robotpsa/enable-https.sh`
- `/etc/letsencrypt/renewal-hooks/deploy/haproxy-robotpsa.sh`

Логика:

1. `issue-letsencrypt.sh` проверяет DNS для `robotpsa.ru` и `www.robotpsa.ru`.
2. Проверяет HTTP-01 webroot через `http://robotpsa.ru/.well-known/acme-challenge/...`.
3. Выпускает сертификат через `certbot certonly --webroot`.
4. Deploy-hook собирает HAProxy PEM:

```text
/etc/haproxy/certs/robotpsa.ru.pem
```

5. `enable-https.sh` включает HTTPS-маршрут в HAProxy только если PEM уже существует.
6. Перед применением HAProxy всегда выполняется `haproxy -c`.
7. Перед заменой конфига создается backup.

Повторный безопасный запуск, если нужно перевыпустить или восстановить HTTPS:

```bash
/opt/robotpsa/issue-letsencrypt.sh
/opt/robotpsa/enable-https.sh
```

Проверка после включения:

```bash
curl -fsSI https://robotpsa.ru/
curl -fsSI https://www.robotpsa.ru/
printf 'show stat\n' | socat - /run/haproxy/admin.sock | grep -E 'robotpsa|https_frontend'
```

## Деплой новой версии сайта

Локально:

```bash
node --check app.js
COPYFILE_DISABLE=1 tar --no-xattrs -czf robotpsa-site.tar.gz \
  --exclude='./serve_static.py' \
  --exclude='./robotpsa-site.service' \
  .
```

На сервере:

```bash
stamp="$(date +%Y%m%d-%H%M%S)"
release="/srv/robotpsa/releases/$stamp"
install -d -o root -g root -m 0755 "$release"
tar -xzf /tmp/robotpsa-site.tar.gz -C "$release"
chown -R root:root "$release"
find "$release" -type d -exec chmod 0755 {} +
find "$release" -type f -exec chmod 0644 {} +
ln -sfn "$release" /srv/robotpsa/current.new
mv -Tf /srv/robotpsa/current.new /srv/robotpsa/current
systemctl reload-or-restart robotpsa-site.service
```

Проверка:

```bash
systemctl is-active robotpsa-site.service
curl -fsSI http://127.0.0.1:18080/
curl -fsSI -H 'Host: robotpsa.ru' http://127.0.0.1/
```

## HAProxy safety checklist

Перед любым изменением:

```bash
cp -a /etc/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg.codex-<reason>-$(date +%Y%m%d-%H%M%S).bak
haproxy -c -f /tmp/new-haproxy.cfg
```

После установки:

```bash
haproxy -c -f /etc/haproxy/haproxy.cfg
systemctl reload haproxy
systemctl is-active haproxy
```

Проверить важные порты:

```bash
for p in 80 443 25 465 587 993 143 41677 42677; do
  ss -lnt "sport = :$p" | awk -v p="$p" 'NR>1{found=1} END{print p, found ? "listening" : "NOT_LISTENING"}'
done
```

Порт `42678` был намеренно убран и должен оставаться закрытым.

## Rollback

Откат сайта:

```bash
ls -1 /srv/robotpsa/releases
ln -sfn /srv/robotpsa/releases/<previous-release> /srv/robotpsa/current.new
mv -Tf /srv/robotpsa/current.new /srv/robotpsa/current
systemctl reload-or-restart robotpsa-site.service
```

Откат HAProxy:

```bash
cp -a /etc/haproxy/haproxy.cfg.codex-<backup>.bak /etc/haproxy/haproxy.cfg
haproxy -c -f /etc/haproxy/haproxy.cfg
systemctl reload haproxy
```

Известные backup-файлы:

- `/etc/haproxy/haproxy.cfg.codex-20260610-061530.bak`
- `/etc/haproxy/haproxy.cfg.codex-robotpsa-20260610-034954.bak`

## Что не трогать без отдельной проверки

- Mail backend `192.168.115.231`
- TCP/SNI маршруты для почты и 1С
- OpenVPN и системные сервисы, которые `needrestart` может предлагать перезапустить
- `git reset --hard`, удаление release-каталогов, массовые `chmod -R`
