import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to backfill service colors.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
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

const LEGACY_DEFAULT_COLORS = new Set<string>([
  "#3f8e88",
  "#756599",
  "#b8791f",
  "#b83a3a",
  "#5b8c5a",
  "#5a8cb8",
  "#6b7280",
]);

const APPLY = process.argv.includes("--apply");

async function main() {
  const services = await prisma.serviceType.findMany({
    orderBy: { name: "asc" },
  });

  const changes: Array<{ id: string; name: string; kind: string; from: string | null; to: string }> = [];
  for (const service of services) {
    const expected = KIND_DEFAULT_COLORS[service.kind] ?? "#1f6b6f";
    const current = service.color ?? null;
    const isLegacyDefault = current === null || LEGACY_DEFAULT_COLORS.has(current);
    if (!isLegacyDefault) continue;
    if (current === expected) continue;
    changes.push({ id: service.id, name: service.name, kind: service.kind, from: current, to: expected });
  }

  if (!changes.length) {
    console.log("No service types need color backfill.");
    return;
  }

  console.log(`${changes.length} service type(s) to update:`);
  for (const change of changes) {
    console.log(` - ${change.name} (${change.kind}): ${change.from ?? "null"} -> ${change.to}`);
  }

  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to persist these changes.");
    return;
  }

  await prisma.$transaction(
    changes.map((change) =>
      prisma.serviceType.update({
        where: { id: change.id },
        data: { color: change.to },
      })
    )
  );
  console.log(`\nApplied ${changes.length} color update(s).`);
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
