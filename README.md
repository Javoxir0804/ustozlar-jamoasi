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

Birinchi adminni yaratish: botda ro'yxatdan o'ting, so'ng bazada `UPDATE "User" SET role='ADMIN' WHERE phone='+998...';`.

## Muhim qoidalar

- Ro'yxatdan faqat botda o'tiladi; sayt foydalanuvchini Telegram ID bo'yicha taniydi (Web App `initData` yoki Login Widget, imzo serverda tekshiriladi).
- Test vaqti server soati bo'yicha; vaqt tugasa urinish avtomatik yakunlanadi. To'g'ri javoblar test davomida brauzerga yuborilmaydi.
- Javob berilgan savol o'chirilmaydi, faqat nofaol qilinadi (eski natijalar buzilmasligi uchun).
- Qo'lda to'lov: ustoz botda tarif tanlaydi, kartaga o'tkazadi, chek rasmini yuboradi; chek `ADMIN_CHAT_ID` ga tugmalar bilan boradi; admin tasdiqlasa obuna avtomatik uzayadi. Karta raqami `payment` sozlamasida.
- Majburiy kanallar admin paneldan qo'shiladi; bot har bir kanalda admin bo'lishi kerak, aks holda a'zolikni tekshira olmaydi.

## Holat

1-bosqich (asos) va test tizimining yadrosi tayyor. Keyingi: admin panel interfeysi, video darslar sahifasi, shaxsiy kabinet, sertifikat shablonini tahrirlash, Excel eksport, RASH tungi vazifasi, kunlik zaxira, serverga joylash. To'liq reja: loyiha hujjatida.
