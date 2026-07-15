#!/usr/bin/env bash
#
# deploy-standalone.sh — деплой Artum через ЛОКАЛЬНУЮ сборку (next.config: output:'standalone').
#
# Отличие от deploy.sh: сборка идёт на твоём ноуте, на сервер уезжает только
# готовый минимальный артефакт (.next/standalone + public + static). Сервер
# больше НЕ запускает `npm ci`/`next build` → ему хватает 1 ГБ RAM.
#
# Предпосылки на сервере (делаются один раз, см. runbook):
#   • создан pm2-процесс `artum`:
#       cd /var/www/artum && PORT=3000 HOSTNAME=127.0.0.1 pm2 start server.js --name artum && pm2 save
#   • лежит /var/www/artum/.env.local (секреты; rsync их НЕ трогает — исключены ниже)
#
# ВАЖНО: NEXT_PUBLIC_* впекаются в клиентский бандл из ЛОКАЛЬНОГО .env.local во
# время сборки. Убедись, что локальный .env.local содержит ПРОДовые значения
# (URL/anon-ключ Supabase должны совпадать с прод-проектом).
#
# Использование:
#   ARTUM_SERVER=root@1.2.3.4 ./deploy-standalone.sh
#   (или впиши IP в SERVER= ниже)
#
set -euo pipefail

SERVER="${ARTUM_SERVER:-root@89.169.1.6}"   # прод: Timeweb 2ГБ, standalone (переопр.: ARTUM_SERVER=root@IP)
KEY="$HOME/.ssh/artum_deploy"
REMOTE_DIR="/var/www/artum"
# keepalive — чтобы длинный rsync не оборвался по тишине (как в deploy.sh)
SSH_CMD="ssh -i $KEY -o IdentitiesOnly=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=20 -o TCPKeepAlive=yes"

if [[ "$SERVER" == *NEW_IP_HERE* ]]; then
  echo "✗ Укажи IP сервера: отредактируй SERVER= в скрипте или запусти" >&2
  echo "    ARTUM_SERVER=root@1.2.3.4 ./deploy-standalone.sh" >&2
  exit 1
fi

echo "→ [1/4] Локальная сборка (next build сам грузит .env.local)…"
# ВНИМАНИЕ: именно `npx next build`, НЕ `npm run build`. Хук prebuild
# (`tsx src/env.ts`) запускается голым процессом и не читает .env.local →
# падает на валидации. `next build` подхватывает .env.local сам.
npx next build

echo "→ [2/4] Упаковка: public/ и .next/static не входят в standalone — копируем внутрь…"
cp -r public .next/standalone/
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/

echo "→ [3/4] Загрузка артефакта на сервер (серверный .env.local сохраняется)…"
rsync -az --delete \
  --exclude '.env.local' \
  -e "$SSH_CMD" \
  .next/standalone/ "$SERVER:$REMOTE_DIR/"

echo "→ [4/4] Перезапуск приложения…"
$SSH_CMD "$SERVER" "cd $REMOTE_DIR && pm2 restart artum --update-env && pm2 save"

echo "✓ Готово. https://artumacademy.ru"
