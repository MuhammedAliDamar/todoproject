import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "ali@globadigital.com";
  const password = "AliDamar!1";
  const name = "Ali Damar";

  // Kullanıcı zaten varsa atla
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Kullanıcı zaten mevcut: ${email}`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
    },
  });

  console.log(`Kullanıcı oluşturuldu: ${user.email} (id: ${user.id})`);
}

main()
  .catch((e) => {
    console.error("Seed hatası:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
