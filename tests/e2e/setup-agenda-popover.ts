import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/lib/password";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@zeni.test";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "Fernanda";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Zenipets";

const TUTOR_ID = "e2e-agenda-tutor";
const PET_ID = "e2e-agenda-pet";
const RESERVATION_ID = "e2e-agenda-reservation";
const SERVICE_ID = "e2e-agenda-boarding";
const RULE_ID = "e2e-agenda-rule-pix";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for agenda popover E2E setup.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function cleanup() {
  await prisma.reservation.deleteMany({ where: { id: RESERVATION_ID } });
  await prisma.servicePriceRule.deleteMany({ where: { id: RULE_ID } });
  await prisma.serviceType.deleteMany({ where: { id: SERVICE_ID } });
  await prisma.pet.deleteMany({ where: { id: PET_ID } });
  await prisma.tutor.deleteMany({ where: { id: TUTOR_ID } });
}

async function main() {
  if (process.argv.includes("--cleanup")) {
    await cleanup();
    return;
  }

  await cleanup();

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: ADMIN_EMAIL }, { username: ADMIN_USERNAME }] },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: ADMIN_EMAIL,
        username: ADMIN_USERNAME,
        passwordHash: hashPassword(ADMIN_PASSWORD),
      },
    });
  } else {
    await prisma.user.create({
      data: {
        name: "Fernanda Zeni",
        email: ADMIN_EMAIL,
        username: ADMIN_USERNAME,
        passwordHash: hashPassword(ADMIN_PASSWORD),
        role: "OWNER",
      },
    });
  }

  await prisma.tutor.create({
    data: {
      id: TUTOR_ID,
      name: "Agenda Tutor E2E",
      email: "agenda-tutor-e2e@example.com",
      status: "ACTIVE",
    },
  });

  await prisma.pet.create({
    data: {
      id: PET_ID,
      tutorId: TUTOR_ID,
      name: "Agenda Pet E2E",
    },
  });

  await prisma.serviceType.create({
    data: {
      id: SERVICE_ID,
      name: "Hospedagem Agenda E2E",
      slug: "hospedagem-agenda-e2e",
      kind: "BOARDING",
      color: "#2f8f83",
      isActive: true,
    },
  });

  await prisma.servicePriceRule.create({
    data: {
      id: RULE_ID,
      serviceTypeId: SERVICE_ID,
      label: "Diaria agenda",
      paymentMethod: "PIX",
      firstPetCents: 8000,
      isActive: true,
    },
  });

  await prisma.reservation.create({
    data: {
      id: RESERVATION_ID,
      tutorId: TUTOR_ID,
      serviceTypeId: SERVICE_ID,
      priceRuleId: RULE_ID,
      pricingPaymentMethod: "PIX",
      pricingMode: "fixed",
      status: "CONFIRMED",
      paymentStatus: "PENDING",
      startsAt: new Date(2026, 5, 10),
      endsAt: new Date(2026, 5, 12),
      notes: "Reserva agenda popover e2e",
      baseAmountCents: 16000,
      totalCents: 16000,
      depositSuggestedCents: 8000,
      depositDueCents: 8000,
      balanceDueCents: 8000,
      reservationPets: {
        create: [{ petId: PET_ID, priceRole: "first_pet" }],
      },
    },
  });
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
