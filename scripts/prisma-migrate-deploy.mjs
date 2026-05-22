import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "prisma.cmd" : "prisma";
const result = spawnSync(command, ["migrate", "deploy"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK:
      process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK ?? "1",
  },
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
