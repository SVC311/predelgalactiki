# Установка на VPS (Русоникс или любой другой)

Сервер игры — один файл `server.js` на Node.js без зависимостей. Он раздаёт саму игру на порту 80 и хранит онлайн-партии в папке `data/`. Подходят Ubuntu/Debian и Rocky/Alma Linux.

## 1. Подключиться к серверу

Windows — PowerShell, macOS — Терминал. Пароль root прислал Русоникс (при вводе он не отображается, это нормально).

```
ssh root@IP_СЕРВЕРА
```

## 2. Токен GitHub (репозиторий приватный)

github.com → аватар → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token. Repository access: Only select repositories → `predelgalactiki`. Permissions → Repository permissions → **Contents: Read-only**. Скопируйте токен (`github_pat_…`).

## 3. Установить

Вставьте три строки, заменив `ТОКЕН`:

```
(command -v apt-get && apt-get update && apt-get install -y git curl) || dnf install -y git curl
git clone https://ТОКЕН@github.com/SVC311/predelgalactiki.git /opt/predelgalactiki
bash /opt/predelgalactiki/deploy/install.sh
```

В конце скрипт напишет `Готово! Игра: http://IP/`. Если написал, что сервер не ответил, пришлите вывод `journalctl -u predely -n 30 --no-pager`.

## Как играть по сети

1. Первый игрок открывает `http://IP_СЕРВЕРА/`, нажимает **Игра по сети**, выбирает расы и нажимает **Создать и получить ссылку**.
2. Ссылку вида `http://…/?room=ABCDE` он отправляет второму игроку.
3. Второй игрок открывает ссылку и сразу оказывается в партии. Ходить может только тот, чей сейчас ход, а ходы соперника видны с анимацией и звуком.

Если обновить страницу, партия продолжится с того же места. Партии хранятся неделю после последнего хода.

## Обновление игры

Обновлять вручную не нужно. Скрипт установки включает автообновление: раз в минуту сервер проверяет ветку `main` на GitHub и, если там новые коммиты, подтягивает их и перезапускает игру. Начатые онлайн-партии при этом сохраняются.

Если сервер ставили до появления автообновления, включите его один раз:

```
cd /opt/predelgalactiki && git pull && bash deploy/install.sh
```

Проверить, что автообновление работает:

```
systemctl list-timers predely-update.timer
journalctl -u predely-update -n 20 --no-pager
```

Автообновление пользуется тем же токеном GitHub, что и `git clone`. Когда срок токена закончится, обновления остановятся. Тогда создайте новый токен и выполните `git -C /opt/predelgalactiki remote set-url origin https://НОВЫЙ_ТОКЕН@github.com/SVC311/predelgalactiki.git`.

Выключить автообновление: `systemctl disable --now predely-update.timer`.

## Необязательно: домен и HTTPS через nginx

Тогда сервер игры переводится обратно на порт 8080 (`Environment=PORT=8080` в `/etc/systemd/system/predely.service`), а nginx с `deploy/nginx.conf` принимает порт 80 и передаёт запросы игре.
