# Установка на VPS (Русоникс или любой другой)

Сервер игры — один файл `server.js` на Node.js без зависимостей. Он раздаёт саму игру и хранит онлайн-партии в папке `data/`.

Инструкция для VPS на Ubuntu 22.04/24.04 с доступом по SSH. Все команды выполняются от root.

## 1. Подключиться к серверу

IP-адрес и пароль root пришлёт Русоникс после создания VPS. Подключение: Windows — PowerShell, macOS — Терминал.

```
ssh root@IP_СЕРВЕРА
```

## 2. Установить Node.js и git

```
apt update && apt install -y nodejs git
node --version
```

Нужна версия 18 или новее. Если команда показала версию ниже, поставьте свежий Node.js:

```
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
```

## 3. Загрузить игру

Репозиторий приватный, поэтому для `git clone` нужен токен GitHub: github.com → Settings → Developer settings → Personal access tokens → Fine-grained, доступ только к `predelgalactiki`, право Contents: Read.

```
git clone https://ТОКЕН@github.com/SVC311/predelgalactiki.git /opt/predelgalactiki
```

Без токена можно так: на странице репозитория нажать **Code → Download ZIP**, распаковать архив и загрузить папку на сервер в `/opt/predelgalactiki` через WinSCP или FileZilla (протокол SFTP, тот же логин и пароль).

## 4. Запустить как службу

```
mkdir -p /opt/predelgalactiki/data && chown -R www-data /opt/predelgalactiki/data
cp /opt/predelgalactiki/deploy/predely.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now predely
systemctl status predely --no-pager
```

Теперь игра открывается по адресу `http://IP_СЕРВЕРА:8080`. Если страница не грузится, откройте порт:

```
ufw allow 8080/tcp
```

## 5. Необязательно: обычный адрес без :8080

```
apt install -y nginx
cp /opt/predelgalactiki/deploy/nginx.conf /etc/nginx/sites-available/predely
ln -s /etc/nginx/sites-available/predely /etc/nginx/sites-enabled/predely
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ufw allow 80/tcp
```

После этого игра доступна по `http://IP_СЕРВЕРА`. Если к серверу привязан домен, замените `server_name _;` в `nginx.conf` на домен. HTTPS можно добавить командой `apt install -y certbot python3-certbot-nginx && certbot --nginx`.

## Как играть по сети

1. Первый игрок открывает игру, нажимает **Игра по сети**, выбирает расы и нажимает **Создать и получить ссылку**.
2. Ссылку вида `http://…/?room=ABCDE` он отправляет второму игроку.
3. Второй игрок открывает ссылку и сразу оказывается в партии. Ходить может только тот, чей сейчас ход, а ходы соперника видны с анимацией и звуком.

Если обновить страницу, партия продолжится с того же места. Партии хранятся неделю после последнего хода.

## Обновление игры

```
cd /opt/predelgalactiki && git pull && systemctl restart predely
```
