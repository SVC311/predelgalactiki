#!/bin/bash
# Автообновление: раз в минуту проверяет main на GitHub и, если есть новые коммиты, подтягивает их и перезапускает игру.
# Запускается таймером predely-update.timer. Журнал: journalctl -u predely-update -n 30 --no-pager
set -e
DIR=${PREDELY_DIR:-/opt/predelgalactiki}
cd "$DIR"
git fetch -q origin main
OLD=$(git rev-parse HEAD) NEW=$(git rev-parse origin/main)
[ "$OLD" = "$NEW" ] && exit 0

echo "Обновление ${OLD:0:7} → ${NEW:0:7}: $(git log -1 --format=%s origin/main)"
git merge -q --ff-only origin/main

# если поменялись файлы служб — переустановить их
for u in predely.service predely-update.service predely-update.timer; do
  cmp -s "deploy/$u" "${UNIT_DIR:-/etc/systemd/system}/$u" || { cp "deploy/$u" "${UNIT_DIR:-/etc/systemd/system}/"; RELOAD=1; }
done
[ -n "$RELOAD" ] && systemctl daemon-reload

systemctl restart predely
sleep 2
if curl -fsS -o /dev/null http://127.0.0.1/; then echo "Готово: игра обновлена"
else echo "ВНИМАНИЕ: после обновления сервер не отвечает"; journalctl -u predely -n 20 --no-pager; exit 1; fi
