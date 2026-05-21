import "dotenv/config";
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "Fernanda";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Zenipets";
const RESERVATION_ID = "e2e-agenda-reservation";

function runAgendaSetup(mode?: "--cleanup") {
  if (process.platform === "win32") {
    const args = ["/d", "/c", "node_modules\\.bin\\tsx.cmd", "tests/e2e/setup-agenda-popover.ts"];
    if (mode) args.push(mode);
    execFileSync("cmd.exe", args, {
      cwd: process.cwd(),
      stdio: "inherit",
    });
    return;
  }

  execFileSync("node_modules/.bin/tsx", ["tests/e2e/setup-agenda-popover.ts", ...(mode ? [mode] : [])], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="identifier"]', ADMIN_USERNAME);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await page.waitForURL(/dashboard/);
}

test.beforeAll(async () => {
  runAgendaSetup();
});

test.afterAll(async () => {
  runAgendaSetup("--cleanup");
});

test("shows pet-service in agenda and opens reservation popover", async ({ page }) => {
  await login(page);
  await page.goto("/agenda?month=2026-06");

  const chip = page
    .getByRole("button", { name: /Agenda Pet E2E - Hospedagem Agenda E2E/ })
    .first();
  await expect(chip).toBeVisible();
  await expect(chip).toContainText("Agenda Pet E2E - Hospedagem Agenda E2E");
  await expect(chip).not.toContainText("Agenda Tutor E2E - Hospedagem Agenda E2E");

  await chip.click();

  const popover = page.getByRole("dialog", { name: /Detalhes da reserva de Agenda Pet E2E/ });
  await expect(popover).toBeVisible();
  await expect(popover).toContainText("Agenda Pet E2E");
  await expect(popover).toContainText("Agenda Tutor E2E");
  await expect(popover).toContainText("Hospedagem Agenda E2E");
  await expect(popover).toContainText("10/06/2026 - 12/06/2026");
  await expect(popover).toContainText("confirmada");
  await expect(popover).toContainText("pendente");
  await expect(popover).toContainText("R$ 160,00");

  await popover.getByRole("link", { name: "Abrir reserva" }).click();
  await expect(page).toHaveURL(new RegExp(`/reservas/${RESERVATION_ID}$`));
});
