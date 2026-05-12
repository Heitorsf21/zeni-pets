import "dotenv/config";
import { getPrisma } from "@/lib/db";
import { selectDefaultPriceRule } from "@/lib/pricing";
import { slugifyServiceName } from "@/lib/service-types";
import type { PaymentMethod, ServicePriceRule, ServiceType } from "@/generated/prisma/client";

type ServiceWithCounts = ServiceType & {
  priceRules: ServicePriceRule[];
  _count: { reservations: number };
};

const APPLY = process.argv.includes("--apply");

function canonicalScore(service: ServiceWithCounts) {
  const activeRules = service.priceRules.filter((rule) => rule.isActive).length;
  return activeRules * 100 + service._count.reservations * 10 + (service.isActive ? 1 : 0);
}

function chooseCanonical(services: ServiceWithCounts[]) {
  return [...services].sort((a, b) => {
    const diff = canonicalScore(b) - canonicalScore(a);
    if (diff !== 0) return diff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];
}

function preferredPaymentMethod(input: {
  pricingPaymentMethod?: PaymentMethod | null;
  payments: Array<{ method: PaymentMethod; status: string; paidAt: Date | null; createdAt: Date }>;
}) {
  if (input.pricingPaymentMethod) return input.pricingPaymentMethod;
  return (
    input.payments
      .filter((payment) => payment.status === "PAID")
      .sort((a, b) => (a.paidAt ?? a.createdAt).getTime() - (b.paidAt ?? b.createdAt).getTime())[0]
      ?.method ?? "PIX"
  );
}

async function movePriceRule(
  tx: ReturnType<typeof getPrisma>,
  rule: ServicePriceRule,
  canonicalServiceId: string,
) {
  const existing = await tx.servicePriceRule.findUnique({
    where: {
      serviceTypeId_label_paymentMethod: {
        serviceTypeId: canonicalServiceId,
        label: rule.label,
        paymentMethod: rule.paymentMethod,
      },
    },
  });

  if (!existing) {
    await tx.servicePriceRule.update({
      where: { id: rule.id },
      data: { serviceTypeId: canonicalServiceId },
    });
    return rule.id;
  }

  await tx.servicePriceRule.update({
    where: { id: existing.id },
    data: {
      firstPetCents: existing.firstPetCents || rule.firstPetCents,
      additionalPetCents: existing.additionalPetCents ?? rule.additionalPetCents,
      highSeasonFirstPetCents: existing.highSeasonFirstPetCents ?? rule.highSeasonFirstPetCents,
      highSeasonAdditionalCents: existing.highSeasonAdditionalCents ?? rule.highSeasonAdditionalCents,
      fixedFeeCents: existing.fixedFeeCents ?? rule.fixedFeeCents,
      perKmCents: existing.perKmCents ?? rule.perKmCents,
      hygieneFeeCents: existing.hygieneFeeCents ?? rule.hygieneFeeCents,
      isActive: existing.isActive || rule.isActive,
    },
  });
  await tx.reservation.updateMany({
    where: { priceRuleId: rule.id },
    data: { priceRuleId: existing.id, pricingPaymentMethod: existing.paymentMethod },
  });
  await tx.servicePriceRule.delete({ where: { id: rule.id } });
  return existing.id;
}

async function attachMissingReservationRules(tx: ReturnType<typeof getPrisma>, serviceTypeId: string) {
  const [rules, reservations] = await Promise.all([
    tx.servicePriceRule.findMany({
      where: { serviceTypeId, isActive: true },
      orderBy: [{ paymentMethod: "asc" }, { label: "asc" }],
    }),
    tx.reservation.findMany({
      where: { serviceTypeId, priceRuleId: null },
      include: { payments: true },
    }),
  ]);
  if (!rules.length || !reservations.length) return 0;

  let linked = 0;
  for (const reservation of reservations) {
    const preferred = preferredPaymentMethod(reservation);
    const rule = rules.find((item) => item.paymentMethod === preferred) ?? selectDefaultPriceRule(rules);
    if (!rule) continue;
    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        priceRuleId: rule.id,
        pricingPaymentMethod: rule.paymentMethod,
      },
    });
    linked++;
  }
  return linked;
}

async function main() {
  const prisma = getPrisma();
  const services = await prisma.serviceType.findMany({
    include: {
      priceRules: true,
      _count: { select: { reservations: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, ServiceWithCounts[]>();
  for (const service of services) {
    const slug = slugifyServiceName(service.name);
    groups.set(slug, [...(groups.get(slug) ?? []), service]);
  }

  const duplicateGroups = [...groups.entries()].filter(([, items]) => items.length > 1);
  const summary = {
    duplicateGroups: duplicateGroups.length,
    movedReservations: 0,
    movedRules: 0,
    linkedReservations: 0,
    deletedServices: 0,
    slugsUpdated: 0,
  };

  if (!APPLY) {
    console.table(
      duplicateGroups.map(([slug, items]) => ({
        slug,
        services: items.map((service) => `${service.name} (${service.id})`).join(" | "),
        canonical: chooseCanonical(items).name,
      })),
    );
    console.log("Dry-run. Execute com --apply para consolidar.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const [slug, items] of duplicateGroups) {
      const canonical = chooseCanonical(items);
      const duplicateIds = items.filter((item) => item.id !== canonical.id).map((item) => item.id);
      if (duplicateIds.length) {
        await tx.serviceType.updateMany({
          where: { id: { in: duplicateIds } },
          data: { slug: null },
        });
      }
      await tx.serviceType.update({
        where: { id: canonical.id },
        data: { slug, isActive: true },
      });
      summary.slugsUpdated++;

      for (const duplicate of items.filter((item) => item.id !== canonical.id)) {
        for (const rule of duplicate.priceRules) {
          await movePriceRule(tx as ReturnType<typeof getPrisma>, rule, canonical.id);
          summary.movedRules++;
        }

        const moved = await tx.reservation.updateMany({
          where: { serviceTypeId: duplicate.id },
          data: { serviceTypeId: canonical.id },
        });
        summary.movedReservations += moved.count;

        await tx.serviceType.delete({ where: { id: duplicate.id } });
        summary.deletedServices++;
      }
    }

    const remainingServices = await tx.serviceType.findMany({
      select: { id: true, name: true, slug: true },
    });
    for (const service of remainingServices) {
      if (!service.slug) {
        await tx.serviceType.update({
          where: { id: service.id },
          data: { slug: slugifyServiceName(service.name) },
        });
        summary.slugsUpdated++;
      }
      summary.linkedReservations += await attachMissingReservationRules(
        tx as ReturnType<typeof getPrisma>,
        service.id,
      );
    }
  });

  console.table(summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
