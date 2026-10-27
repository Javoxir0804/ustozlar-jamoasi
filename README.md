# Attestatsiya platformasi

Ustozlarni attestatsiyaga onlayn tayyorlash uchun pullik platforma: video darslar va testlar.
Bitta sayt + bitta Telegram bot, ikkalasi bitta API va bitta PostgreSQL bazadan foydalanadi.

## Tuzilma

| Papka | Nima |
| --- | --- |
| `packages/db` | Prisma sxemasi (barcha jadvallar), migratsiyalar, namuna ma'lumotlar |
| `apps/api` | Express API: Telegram orqali kirish, test ishlash va baholash, sertifikat (PDF + QR), reyting, admin, CSV eksport, qo'lda to'lov |
| `apps/bot` | grammY bot: bir martalik ro'yxat, majburiy kanal tekshiruvi, menyular, Top 10, obuna (chek orqali) |
| `apps/web` | React sayt: test oynasi (taymer, belgilash, navigatsiya, tasdiq oynasi, formulalar), sertifikat tekshirish sahifasi. Botda Telegram Web App sifatida ochiladi |

## Ishga tushirish (lokal)

Talab: Node.js 20+, pnpm, PostgreSQL 16 (yoki `docker compose up -d db`).

```bash
pnpm install
cp .env.example .env            # BOT_TOKEN, BOT_USERNAME, ADMIN_CHAT_ID ni to'ldiring
cp .env packages/db/.env
pnpm db:migrate                 # jadvallarni yaratadi
pnpm db:seed                    # Fizika fani, namuna test, tariflar
pnpm dev:api                    # http://localhost:4000
pnpm dev:web                    # http://localhost:5173
pnpm dev:bot
pnpm test                       # API va bot testlari (PostgreSQL kerak)
```

Birinchi admin: `.env` dagi `ADMIN_TELEGRAM_IDS` ga Telegram ID ingizni yozing va botda ro'yxatdan o'ting.

## Render'ga joylash

Platformani Render'ga 2 xil usulda joylash mumkin:

### 1-usul: Render Blueprint (Tavsiya etiladi — 1 tugma bilan)
Loyihada `render.yaml` mavjud.
1. Render Dashboard -> **New +** -> **Blueprint** bo'limiga kiring.
2. Repozitoriyani (`ustozlar-jamoasi`) tanlang.
3. Render PostgreSQL bazasi (`ustozlar-db`) va Veb-xizmatni (`ustozlar-jamoasi`) avtomatik yaratadi.
4. Faqat bot sozlamalarini kiriting:
   - `BOT_TOKEN` — @BotFather'dan olingan bot tokeni
   - `ADMIN_CHAT_ID` — to'lov cheklari boradigan chat ID si
   - `ADMIN_TELEGRAM_IDS` — admin huquqi beriladigan Telegram ID lar
5. **Apply** tugmasini bosing — baza migratsiyalari va dastlabki ma'lumotlar avtomatik ishga tushadi.

### 2-usul: Qo'lda Web Service yaratish (Docker)
- Environment: **Docker** (Dockerfile orqali avtomatik yig'iladi)
- Port: `10000` (avtomatik o'rnatilgan)
- Health Check Path: `/health`
- Muhit o'zgaruvchilari:
  - `DATABASE_URL` — PostgreSQL ulanish manzili (Render PostgreSQL internal URL)
  - `JWT_SECRET` — xavfsiz kalit satri
  - `BOT_API_KEY` — bot API kaliti
  - `BOT_TOKEN` — Telegram bot tokeni
  - `ADMIN_CHAT_ID` — to'lov cheklari boradigan chat ID
  - `ADMIN_TELEGRAM_IDS` — admin ID lari
  - `PUBLIC_WEB_URL` — Render xizmatingiz domeni (masalan: `https://ustozlar-jamoasi.onrender.com`)

Saytdagi "Telegram orqali kirish" ishlashi uchun BotFather'da `/setdomain` bilan sayt domenini kiriting.

## Muhim qoidalar

- Ro'yxatdan faqat botda o'tiladi; sayt foydalanuvchini Telegram ID bo'yicha taniydi (Web App `initData` yoki Login Widget, imzo serverda tekshiriladi).
- Test vaqti server soati bo'yicha; vaqt tugasa urinish avtomatik yakunlanadi. To'g'ri javoblar test davomida brauzerga yuborilmaydi.
- Javob berilgan savol o'chirilmaydi, faqat nofaol qilinadi (eski natijalar buzilmasligi uchun).
- Qo'lda to'lov: ustoz botda tarif tanlaydi, kartaga o'tkazadi, chek rasmini yuboradi; chek `ADMIN_CHAT_ID` ga tugmalar bilan boradi; admin tasdiqlasa obuna avtomatik uzayadi. Karta raqami `payment` sozlamasida.
- Majburiy kanallar admin paneldan qo'shiladi; bot har bir kanalda admin bo'lishi kerak, aks holda a'zolikni tekshira olmaydi.

## Holat

1-bosqich (asos) va test tizimining yadrosi tayyor. Keyingi: admin panel interfeysi, video darslar sahifasi, shaxsiy kabinet, sertifikat shablonini tahrirlash, Excel eksport, RASH tungi vazifasi, kunlik zaxira, serverga joylash. To'liq reja: loyiha hujjatida.
