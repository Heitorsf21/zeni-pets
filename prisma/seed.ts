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
    update: { color: "#1f6b6f" },
    create: {
      id: "service-boarding",
      name: "Hospedagem",
      kind: "BOARDING",
      description: "Diaria 24h no hotelzinho.",
      color: "#1f6b6f",
    },
  });

  await prisma.serviceType.upsert({
    where: { id: "service-daycare" },
    update: { color: "#9b5a16" },
    create: {
      id: "service-daycare",
      name: "Creche",
      kind: "DAYCARE",
      description: "Periodo diurno para daycare.",
      color: "#9b5a16",
    },
  });

  await prisma.serviceType.upsert({
    where: { id: "service-sitting" },
    update: { color: "#6b4ba0" },
    create: {
      id: "service-sitting",
      name: "Pet sitter",
      kind: "PET_SITTING",
      description: "Visita domiciliar.",
      color: "#6b4ba0",
    },
  });

  const KIND_DEFAULT_COLORS: Record<string, string> = {
    BOARDING: "#1f6b6f",
    DAYCARE: "#9b5a16",
    PET_SITTING: "#6b4ba0",
    TAXI_PET: "#b8413a",
    DOG_WALKER: "#3f7a3a",
    ADAPTATION: "#2f6cb0",
    OTHER: "#5f6b75",
  };

  const LEGACY_DEFAULT_COLORS = new Set([
    "#3f8e88",
    "#756599",
    "#b8791f",
    "#b83a3a",
    "#5b8c5a",
    "#5a8cb8",
    "#6b7280",
  ]);

  const servicesNeedingBackfill = await prisma.serviceType.findMany({
    where: { OR: [{ color: null }, { color: { in: Array.from(LEGACY_DEFAULT_COLORS) } }] },
  });
  for (const service of servicesNeedingBackfill) {
    const expected = KIND_DEFAULT_COLORS[service.kind] ?? "#3f8e88";
    if (service.color === expected) continue;
    await prisma.serviceType.update({
      where: { id: service.id },
      data: { color: expected },
    });
  }

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
