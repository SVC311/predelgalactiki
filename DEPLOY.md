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

## Журнал партий

Сервер записывает каждую партию, сыгранную через него: на одном экране, против ИИ и по сети. В конце каждого хода игра отправляет журнал целиком: расы, настройки, кто ходил первым, по каждому ходу кристаллы, доход, шахты, отряды и HP базы, а также все действия (перемещения, атаки, постройки, наймы, урон от радиации и способностей) и итог. Имён, IP-адресов и других личных данных в журнале нет. Отменённые через «Отменить» действия в журнал не попадают.

- `http://IP_СЕРВЕРА/logs` — сводка: сколько партий, доля побед каждой расы, пары рас, средняя длина в раундах и минутах, преимущество первого хода, что нанимают, и список последних партий.
- `http://IP_СЕРВЕРА/logs/all.jsonl` — все партии одним файлом, по строке JSON на партию (для Excel, Python и т. п.).
- На сервере журналы лежат в `/opt/predelgalactiki/data/logs/`, по файлу на партию. Сводка в консоли: `node /opt/predelgalactiki/logstats.js`, а по скачанному файлу: `node logstats.js predely-logs-ДАТА.jsonl`.

По умолчанию страница `/logs` открыта всем, кто знает адрес. Чтобы закрыть её ключом, добавьте строку `Environment=LOGS_KEY=придумайте_слово` в `/etc/systemd/system/predely.service`, выполните `systemctl daemon-reload && systemctl restart predely` и открывайте `/logs?key=придумайте_слово`.

Партии, открытые с GitHub Pages или из файла, не записываются: им некуда отправлять журнал.

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
