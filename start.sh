#!/bin/sh
# Render'da ishga tushish: migratsiya, birinchi admin (seed), keyin server.
set -e

if [ -n "$DATABASE_URL" ]; then
  i=0
  until pnpm --filter @edu/db deploy-db || [ $i -ge 10 ]; do
    i=$((i + 1))
    echo "Baza hali tayyor emas ($i/10), 3 soniya kutilmoqda..."
    sleep 3
  done
  pnpm --filter @edu/db seed || echo "Seed o'tmadi (ADMIN_PASSWORD ni tekshiring)"
else
  echo "DATABASE_URL yo'q: migratsiya o'tkazib yuborildi"
fi

exec pnpm --filter @edu/api start
