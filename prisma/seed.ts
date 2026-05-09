import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminUsername = process.env.ADMIN_USERNAME ?? "Fernanda";

  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for the structural seed.");
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Fernanda Zeni",
      username: adminUsername,
      passwordHash: hashPassword(adminPassword),
    },
    create: {
      name: "Fernanda Zeni",
      email: adminEmail,
      username: adminUsername,
      passwordHash: hashPassword(adminPassword),
      role: "OWNER",
    },
  });

  await prisma.businessSettings.upsert({
    where: { singletonKey: "default" },
    update: {},
    create: {
      singletonKey: "default",
      businessName: "Zeni Pets",
      ownerName: "Fernanda Zeni",
    },
  });

  await prisma.serviceType.upsert({
    where: { id: "service-boarding" },
    update: {},
    create: {
      id: "service-boarding",
      name: "Hospedagem",
      kind: "BOARDING",
      description: "Diaria 24h no hotelzinho.",
    },
  });

  await prisma.serviceType.upsert({
    where: { id: "service-daycare" },
    update: {},
    create: {
      id: "service-daycare",
      name: "Creche",
      kind: "DAYCARE",
      description: "Periodo diurno para daycare.",
    },
  });

  await prisma.serviceType.upsert({
    where: { id: "service-sitting" },
    update: {},
    create: {
      id: "service-sitting",
      name: "Pet sitter",
      kind: "PET_SITTING",
      description: "Visita domiciliar.",
    },
  });

  console.log("Structural seed complete. No tutors, pets, reservations, prices, or financial entries were created.");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
