// Namuna ma'lumotlar: fizika fani, bitta test, tarif va sozlamalar.
import { prisma } from "./index.js";

async function main() {
  const physics = await prisma.subject.upsert({
    where: { slug: "fizika" },
    update: {},
    create: { name: "Fizika", slug: "fizika", order: 1 },
  });

  const existing = await prisma.test.findFirst({ where: { subjectId: physics.id } });
  if (!existing) {
    await prisma.test.create({
      data: {
        subjectId: physics.id,
        title: "Fizika: mexanika (namuna)",
        durationMin: 60,
        questionCount: 3,
        isActive: true,
        requiresSubscription: false,
        questions: {
          create: [
            {
              text: "Jism $v = 10$ m/s tezlik bilan $t = 5$ s harakatlandi. Bosib o'tilgan yo'l qancha?",
              order: 1,
              options: {
                create: [
                  { text: "50 m", isCorrect: true, order: 1 },
                  { text: "2 m", order: 2 },
                  { text: "15 m", order: 3 },
                  { text: "500 m", order: 4 },
                ],
              },
            },
            {
              text: "Nyutonning ikkinchi qonuni qaysi formula bilan ifodalanadi?",
              order: 2,
              options: {
                create: [
                  { text: "$F = ma$", isCorrect: true, order: 1 },
                  { text: "$E = mc^2$", order: 2 },
                  { text: "$p = mv$", order: 3 },
                  { text: "$A = Fs$", order: 4 },
                ],
              },
            },
            {
              text: "Erkin tushish tezlanishi taxminan nechaga teng?",
              order: 3,
              options: {
                create: [
                  { text: "$9{,}8$ m/s²", isCorrect: true, order: 1 },
                  { text: "$1$ m/s²", order: 2 },
                  { text: "$3 \\cdot 10^8$ m/s²", order: 3 },
                  { text: "$0{,}5$ m/s²", order: 4 },
                ],
              },
            },
          ],
        },
      },
    });
  }

  if ((await prisma.plan.count()) === 0) {
    await prisma.plan.createMany({
      data: [
        { name: "1 oy", priceUzs: 99000, days: 30 },
        { name: "3 oy", priceUzs: 249000, days: 90 },
      ],
    });
  }

  await prisma.setting.upsert({
    where: { key: "contacts" },
    update: {},
    create: { key: "contacts", value: { phone: "+998 __ ___ __ __", address: "", telegram: "" } },
  });
  await prisma.setting.upsert({
    where: { key: "about" },
    update: {},
    create: { key: "about", value: { text: "Litsey haqida ma'lumot admin paneldan kiritiladi." } },
  });

  await prisma.setting.upsert({
    where: { key: "payment" },
    update: {},
    create: { key: "payment", value: { card: "0000 0000 0000 0000", holder: "Karta egasi F.I.O." } },
  });

  console.log("Seed tayyor");
}

main().finally(() => prisma.$disconnect());
