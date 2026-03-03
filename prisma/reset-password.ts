import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "ali@globadigital.com";
  const newPassword = "AliDamar!1";

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  const user = await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  console.log(`Şifre güncellendi: ${user.email}`);
}

main()
  .catch((e) => {
    console.error("Hata:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
