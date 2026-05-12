import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "Fernanda";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Zenipets";

const TUTOR_ID = "e2e-pricing-tutor";
const PET_ID = "e2e-pricing-pet";
const PET_2_ID = "e2e-pricing-pet-2";
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

test("calculates multi-pet lodging, Zeni pickup, and creates multiple reservation tasks", async ({ page }) => {
  await login(page);
  await page.goto("/reservas");
  await page.getByRole("button", { name: "Nova reserva" }).first().click();

  const dialog = page.locator("dialog[open]");
  await dialog.locator('select[name="tutorId"]').selectOption(TUTOR_ID);
  await dialog.locator(`input[name="petIds"][value="${PET_ID}"]`).check();
  await dialog.locator(`input[name="petIds"][value="${PET_2_ID}"]`).check();
  await dialog.locator('select[name="serviceTypeId"]').selectOption(SERVICE_ID);
  await dialog.locator('select[name="priceRuleId"]').selectOption(RULE_ID);
  await dialog.locator('input[name="startsAt"]').fill("2026-05-07T10:00");
  await dialog.locator('input[name="endsAt"]').fill("2026-05-14T10:00");
  await dialog.locator('select[name="pickupMode"]').selectOption("ZENI_PICKUP");
  await dialog.locator('input[name="distanceKm"]').fill("8");
  await dialog.locator('textarea[name="notes"]').fill("Reserva pricing e2e");
  await dialog.getByRole("button", { name: "Adicionar tarefa" }).click();
  await dialog.locator('input[name="reservationTaskTitle"]').nth(0).fill("Medicacao multi pet e2e");
  await dialog.locator('select[name="reservationTaskPetId"]').nth(0).selectOption(PET_2_ID);
  await dialog.getByRole("button", { name: "Adicionar tarefa" }).click();
  await dialog.locator('input[name="reservationTaskTitle"]').nth(1).fill("Banho seco multi pet e2e");
  await dialog.locator('select[name="reservationTaskPetId"]').nth(1).selectOption(PET_ID);

  await expect(dialog.locator(".row", { hasText: "Pets" })).toContainText("2");
  await expect(dialog.locator(".row", { hasText: "Diárias" })).toContainText("7");
  await expect(dialog.locator(".row", { hasText: "Base da estadia" })).toContainText("R$ 385,00");
  await expect(dialog.locator(".row", { hasText: "Taxi pet" })).toContainText("R$ 35,00");
  await expect(dialog.locator(".row", { hasText: "Total final" })).toContainText("R$ 420,00");

  await dialog.getByRole("button", { name: "Salvar reserva" }).click();
  await page.waitForURL(/reservas\/[0-9a-f-]+/, { timeout: 15000 });

  await expect(page.getByText("Reserva pricing e2e")).toBeVisible();
  await expect(page.locator(".badge--em-andamento").first()).toHaveText("em andamento");
  const tasks = page.locator("section", { hasText: "Tarefas da reserva" }).first();
  await expect(tasks.getByText("Medicacao multi pet e2e")).toBeVisible();
  await expect(tasks.getByText("Banho seco multi pet e2e")).toBeVisible();
  await expect(tasks.getByRole("link", { name: "Pricing Pet Extra E2E" })).toBeVisible();
  await expect(tasks.getByRole("link", { name: "Pricing Pet E2E" })).toBeVisible();
  const payments = page.locator("section", { hasText: "Pagamentos" }).first();
  await expect(payments.locator("div", { hasText: "Base" }).first()).toContainText("R$ 385,00");
  await expect(payments.locator("div", { hasText: "Taxi pet" }).first()).toContainText("R$ 35,00");
  await expect(payments.locator("div", { hasText: "Total" }).first()).toContainText("R$ 420,00");
});
