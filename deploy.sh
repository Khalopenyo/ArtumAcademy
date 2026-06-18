#!/usr/bin/env bash
#
# deploy.sh — деплой Artum Academy на прод-сервер.
#
# Что делает:
#   1. rsync исходников на сервер (без node_modules/.next/.git/.planning)
#   2. npm ci (установка зависимостей по lock-файлу)
#   3. npx next build (сборка; next сам грузит .env.local на сервере)
#   4. pm2 restart + pm2 save
#
# Использование:  ./deploy.sh
#
set -euo pipefail

SERVER="root@5.42.100.106"
KEY="$HOME/.ssh/artum_deploy"
REMOTE_DIR="/var/www/artum"
# ServerAlive* шлёт keepalive каждые 30с (до 10 мин тишины) — иначе sshd/NAT
# рвёт сессию во время долгого тихого `npm ci`/`next build`, и деплой обрывается
# на полпути (наблюдался «Connection closed by remote host»).
SSH_CMD="ssh -i $KEY -o IdentitiesOnly=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=20 -o TCPKeepAlive=yes"

echo "→ [1/3] Синхронизация исходников на сервер…"
rsync -az --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude '.planning' \
  --exclude 'coverage' \
  --exclude 'playwright-report' \
  --exclude 'test-results' \
  --exclude '.DS_Store' \
  --exclude '.env.local' \
  -e "$SSH_CMD" \
  ./ "$SERVER:$REMOTE_DIR/"

echo "→ [2/3] Установка зависимостей + сборка…"
$SSH_CMD "$SERVER" "cd $REMOTE_DIR && npm ci --no-audit --no-fund && npx next build"

echo "→ [3/3] Перезапуск приложения…"
$SSH_CMD "$SERVER" "cd $REMOTE_DIR && pm2 restart artum --update-env && pm2 save"

echo "✓ Готово. https://artumacademy.ru"
