import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/lib/password";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@zeni.test";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "Fernanda";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Zenipets";

const TUTOR_ID = "e2e-pricing-tutor";
const PET_ID = "e2e-pricing-pet";
const PET_2_ID = "e2e-pricing-pet-2";
const RESERVATION_ID = "e2e-pricing-reservation";
const SERVICE_ID = "e2e-pricing-boarding";
const RULE_ID = "e2e-pricing-rule-pix";
const DAYCARE_SERVICE_ID = "e2e-pricing-daycare";
const DAYCARE_RULE_ID = "e2e-pricing-daycare-rule-pix";
const TAXI_SERVICE_ID = "e2e-pricing-taxi";
const TAXI_RULE_ID = "e2e-pricing-taxi-rule-pix";
const TUTOR_NAME = "Pricing Tutor E2E";
const PET_NAME = "Pricing Pet E2E";
const PET_2_NAME = "Pricing Pet Extra E2E";
const SERVICE_NAME = "Hospedagem Pricing E2E";
const DAYCARE_SERVICE_NAME = "Creche Pricing E2E";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for reservation pricing E2E setup.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function cleanup() {
  await prisma.reservation.deleteMany({ where: { tutorId: TUTOR_ID } });
  await prisma.servicePriceRule.deleteMany({ where: { id: { in: [RULE_ID, DAYCARE_RULE_ID, TAXI_RULE_ID] } } });
  await prisma.serviceType.deleteMany({ where: { id: { in: [SERVICE_ID, DAYCARE_SERVICE_ID, TAXI_SERVICE_ID] } } });
  await prisma.pet.deleteMany({ where: { id: { in: [PET_ID, PET_2_ID] } } });
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

  await prisma.businessSettings.upsert({
    where: { singletonKey: "default" },
    update: { depositPercent: 50 },
    create: {
      singletonKey: "default",
      businessName: "Zeni Pets",
      ownerName: "Fernanda Zeni",
      depositPercent: 50,
    },
  });

  await prisma.tutor.upsert({
    where: { id: TUTOR_ID },
    update: { name: TUTOR_NAME, status: "ACTIVE" },
    create: { id: TUTOR_ID, name: TUTOR_NAME, status: "ACTIVE" },
  });
  await prisma.pet.upsert({
    where: { id: PET_ID },
    update: { tutorId: TUTOR_ID, name: PET_NAME },
    create: { id: PET_ID, tutorId: TUTOR_ID, name: PET_NAME },
  });
  await prisma.pet.upsert({
    where: { id: PET_2_ID },
    update: { tutorId: TUTOR_ID, name: PET_2_NAME },
    create: { id: PET_2_ID, tutorId: TUTOR_ID, name: PET_2_NAME },
  });
  await prisma.serviceType.upsert({
    where: { id: SERVICE_ID },
    update: { name: SERVICE_NAME, kind: "BOARDING", isActive: true },
    create: {
      id: SERVICE_ID,
      name: SERVICE_NAME,
      slug: "hospedagem-pricing-e2e",
      kind: "BOARDING",
      isActive: true,
    },
  });
  await prisma.servicePriceRule.upsert({
    where: { id: RULE_ID },
    update: {
      label: "Diária teste",
      paymentMethod: "PIX",
      firstPetCents: 3500,
      additionalPetCents: 2000,
      highSeasonFirstPetCents: null,
      highSeasonAdditionalCents: null,
      fixedFeeCents: null,
      perKmCents: null,
      hygieneFeeCents: null,
      isActive: true,
    },
    create: {
      id: RULE_ID,
      serviceTypeId: SERVICE_ID,
      label: "Diária teste",
      paymentMethod: "PIX",
      firstPetCents: 3500,
      additionalPetCents: 2000,
      isActive: true,
    },
  });
  await prisma.serviceType.upsert({
    where: { id: DAYCARE_SERVICE_ID },
    update: { name: DAYCARE_SERVICE_NAME, kind: "DAYCARE", isActive: true },
    create: {
      id: DAYCARE_SERVICE_ID,
      name: DAYCARE_SERVICE_NAME,
      slug: "creche-pricing-e2e",
      kind: "DAYCARE",
      isActive: true,
    },
  });
  await prisma.servicePriceRule.upsert({
    where: { id: DAYCARE_RULE_ID },
    update: {
      label: "Dia teste",
      paymentMethod: "PIX",
      firstPetCents: 3000,
      additionalPetCents: 1500,
      highSeasonFirstPetCents: null,
      highSeasonAdditionalCents: null,
      fixedFeeCents: null,
      perKmCents: null,
      hygieneFeeCents: null,
      isActive: true,
    },
    create: {
      id: DAYCARE_RULE_ID,
      serviceTypeId: DAYCARE_SERVICE_ID,
      label: "Dia teste",
      paymentMethod: "PIX",
      firstPetCents: 3000,
      additionalPetCents: 1500,
      isActive: true,
    },
  });
  await prisma.serviceType.upsert({
    where: { id: TAXI_SERVICE_ID },
    update: { name: "Taxi Pet Transporte Principal E2E", kind: "TAXI_PET", isActive: true },
    create: {
      id: TAXI_SERVICE_ID,
      name: "Taxi Pet Transporte Principal E2E",
      slug: "taxi-pet-transporte-principal-e2e",
      kind: "TAXI_PET",
      isActive: true,
    },
  });
  await prisma.servicePriceRule.upsert({
    where: { id: TAXI_RULE_ID },
    update: {
      label: "Taxi",
      paymentMethod: "PIX",
      firstPetCents: 0,
      fixedFeeCents: 1000,
      perKmCents: 250,
      hygieneFeeCents: 500,
      isActive: true,
    },
    create: {
      id: TAXI_RULE_ID,
      serviceTypeId: TAXI_SERVICE_ID,
      label: "Taxi",
      paymentMethod: "PIX",
      firstPetCents: 0,
      fixedFeeCents: 1000,
      perKmCents: 250,
      hygieneFeeCents: 500,
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
      startsAt: new Date(2026, 5, 7),
      endsAt: new Date(2026, 5, 14),
      notes: "Reserva hospedagem edit e2e",
      baseAmountCents: 38500,
      totalCents: 38500,
      depositSuggestedCents: 19250,
      depositDueCents: 19250,
      balanceDueCents: 19250,
      reservationPets: {
        create: [
          { petId: PET_ID, priceRole: "first_pet" },
          { petId: PET_2_ID, priceRole: "additional_pet" },
        ],
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
