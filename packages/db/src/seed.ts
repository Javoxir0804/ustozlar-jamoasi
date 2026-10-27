// Boshlang'ich ma'lumotlar. Har ishga tushishda chaqiriladi, mavjud ma'lumotni o'zgartirmaydi.
import { hashPassword, prisma } from "./index.js";

async function main() {
  // Birinchi admin: login va parol server sozlamasidan. Parol keyin qayta yozilmaydi.
  const login = (process.env.ADMIN_USERNAME ?? "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const anyAdmin = await prisma.user.count({ where: { role: "ADMIN" } });
  if (anyAdmin === 0) {
    if (password.length >= 8) {
      await prisma.user.create({
        data: { role: "ADMIN", login, passwordHash: hashPassword(password), firstName: "Bosh", lastName: "Admin", profileCompleted: true },
      });
      console.log(`Birinchi admin yaratildi: ${login}`);
    } else {
      console.warn("ADMIN_PASSWORD (kamida 8 belgi) berilmagan: admin yaratilmadi");
    }
  }

  await prisma.subject.upsert({
    where: { slug: "fizika" },
    update: {},
    create: { name: "Fizika", slug: "fizika", order: 1 },
  });

  const defaults: Record<string, object> = {
    contacts: { phone: "", telegram: "", address: "", email: "" },
    about: { text: "" },
    site: { title: "Ustozlar jamoasi", tagline: "Video darslar, testlar va sertifikatlar bitta platformada" },
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  if ((await prisma.certificateTemplate.count()) === 0) await prisma.certificateTemplate.create({ data: {} });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
