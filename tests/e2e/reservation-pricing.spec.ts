import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "Fernanda";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Zenipets";

const RESERVATION_ID = "e2e-pricing-reservation";
const SERVICE_ID = "e2e-pricing-boarding";
const RULE_ID = "e2e-pricing-rule-pix";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="identifier"]', ADMIN_USERNAME);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await page.waitForURL(/dashboard/);
}

test.beforeAll(async () => {
  runPricingSetup();
});

test.afterAll(async () => {
  runPricingSetup("--cleanup");
});

function runPricingSetup(mode?: "--cleanup") {
  if (process.platform === "win32") {
    const args = ["/d", "/c", "node_modules\\.bin\\tsx.cmd", "tests/e2e/setup-reservation-pricing.ts"];
    if (mode) args.push(mode);
    execFileSync("cmd.exe", args, {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    return;
  }

  execFileSync("node_modules/.bin/tsx", ["tests/e2e/setup-reservation-pricing.ts", ...(mode ? [mode] : [])], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

test("keeps saved boarding service selected when editing a reservation", async ({ page }) => {
  await login(page);
  await page.goto(`/reservas/${RESERVATION_ID}`);
  await expect(page.getByText("Reserva hospedagem edit e2e")).toBeVisible();

  await page.getByRole("link", { name: "Editar reserva" }).click();
  await page.waitForURL(new RegExp(`/reservas/${RESERVATION_ID}/editar$`));

  const form = page.locator("#reservation-edit-form");
  await expect(form.locator('select[name="serviceTypeId"]')).toHaveValue(SERVICE_ID);
  await expect(form.locator('select[name="priceRuleId"]')).toHaveValue(RULE_ID);
  await expect(form.locator('input[name="startsAt"]')).toHaveValue("2026-06-07");
  await expect(form.locator('input[name="endsAt"]')).toHaveValue("2026-06-14");
  await expect(form.getByText("Data da creche")).toHaveCount(0);

  const summary = page.locator("aside", { hasText: "Resumo atualizado" });
  await expect(summary.locator(".row", { hasText: /Servi[cç]o/ })).toContainText("Hospedagem Pricing E2E");
});
