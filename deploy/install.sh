#!/bin/bash
# Установка сервера «Пределов Галактики» на VPS (Ubuntu/Debian или Rocky/Alma/CentOS).
# Запуск от root: bash /opt/predelgalactiki/deploy/install.sh
set -e
DIR=/opt/predelgalactiki
cd "$DIR"

# Node.js 18+
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "== Ставлю Node.js 22"
  if command -v apt-get >/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
  else
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash - && dnf install -y nodejs
  fi
fi
echo "== Node.js $(node --version)"

# отдельный пользователь без входа
id predely >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin predely
mkdir -p "$DIR/data" && chown -R predely "$DIR/data"

cp "$DIR/deploy/predely.service" /etc/systemd/system/predely.service
systemctl daemon-reload
systemctl enable predely >/dev/null 2>&1
systemctl restart predely

# открыть порт 80
if command -v ufw >/dev/null && ufw status | grep -q active; then ufw allow 80/tcp; fi
if command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-service=http && firewall-cmd --reload
fi

sleep 1
if curl -fsS -o /dev/null http://127.0.0.1/; then
  echo "== Готово! Игра: http://$(curl -fsS -4 ifconfig.me 2>/dev/null || hostname -I | cut -d' ' -f1)/"
else
  echo "== Сервер не ответил. Пришлите вывод команды: journalctl -u predely -n 30 --no-pager"
fi
