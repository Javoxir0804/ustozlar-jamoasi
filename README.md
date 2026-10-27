# Ustozlar jamoasi: onlayn ta'lim platformasi

Bitta server: sayt (React), API (Express) va Telegram bot (grammY) bitta PostgreSQL bazadan foydalanadi.

- Talaba Telegram orqali kiradi (saytda Telegram Login, botda Web App) va bir marta anketa to'ldiradi.
- Admin `/admin/login` sahifasida login va parol bilan kiradi. Birinchi admin `ADMIN_USERNAME` va `ADMIN_PASSWORD` dan yaratiladi, qolganlarini admin panelning o'zi qo'shadi.

## Tuzilma

```
apps/api      API, bot, ishlab chiqarish serveri (src/server.ts)
apps/web      Sayt (Vite + React + Tailwind)
packages/db   Prisma sxemasi, migratsiyalar, seed
```

## Kompyuterda ishga tushirish

Kerak: Node.js 22, pnpm 10, PostgreSQL 16.

```bash
cp .env.example .env        # DATABASE_URL va ADMIN_PASSWORD ni yozing
pnpm install
pnpm db:migrate             # jadvallarni yaratadi
pnpm db:seed                # birinchi admin va boshlang'ich sozlamalar
pnpm dev:api                # API: http://localhost:4000 (BOT_TOKEN bo'lsa bot ham)
pnpm dev:web                # Sayt: http://localhost:5173
```

Tekshirish: `pnpm typecheck` va `pnpm test`.

## Render'ga joylash

`render.yaml` veb-servis va bazani yaratadi. Render panelida qo'lda kiritiladiganlar:

| O'zgaruvchi | Nima |
| --- | --- |
| `BOT_TOKEN` | BotFather bergan token |
| `ADMIN_PASSWORD` | Birinchi admin paroli (kamida 8 belgi) |
| `ADMIN_CHAT_ID` | Yangi talaba haqida xabar boradigan chat ID (ixtiyoriy) |

Server ishga tushganda migratsiya va seed o'zi bajariladi, bot webhook'i o'zi o'rnatiladi.

Saytdagi "Telegram orqali kirish" tugmasi ishlashi uchun BotFather'da bir marta: `/setdomain` → botni tanlang → sayt domenini yuboring (masalan `ustozlar-jamoasi.onrender.com`).
