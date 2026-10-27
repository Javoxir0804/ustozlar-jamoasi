#!/bin/sh
set -e

echo "=== Attestatsiya platformasi ishga tushirilmoqda ==="

if [ -n "$DATABASE_URL" ]; then
  echo "Ma'lumotlar bazasi tekshirilmoqda va migratsiyalar qo'llanmoqda..."
  MAX_RETRIES=10
  RETRY_COUNT=0
  until pnpm --filter @att/db exec prisma migrate deploy || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Baza hali tayyor emas ($RETRY_COUNT/$MAX_RETRIES). 3 soniya kutilmoqda..."
    sleep 3
  done

  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "OGOHLANTIRISH: Migratsiya yakunlanmadi, ammo server ishga tushiriladi."
  else
    echo "Migratsiyalar muvaffaqiyatli qo'llandi."
    echo "Baza dastlabki ma'lumotlari (seed) tekshirilmoqda..."
    pnpm --filter @att/db seed || echo "Seed xatosi (e'tiborga olinmadi, ma'lumotlar allaqachon mavjud bo'lishi mumkin)"
  fi
else
  echo "OGOHLANTIRISH: DATABASE_URL o'rnatilmagan! Migratsiya va seed o'tkazib yuborildi."
fi

echo "Asosiy server ishga tushirilmoqda (PORT=${PORT:-10000})..."
exec pnpm --filter @att/api start:prod
