import { expect, test } from "@playwright/test";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "Fernanda";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Zenipets";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="identifier"]', ADMIN_USERNAME);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await page.waitForURL(/dashboard/);
}

test("login and view dashboard v1", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Bom dia, Fernanda" })).toBeVisible();
  await expect(page.getByText("Pets hospedados hoje")).toBeVisible();
});

test("navigate to core MVP routes", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: /Google Agenda/ }).click();
  await expect(page.getByRole("heading", { name: "Google Agenda" })).toBeVisible();
  await page.getByRole("link", { name: /Tutores/ }).click();
  await expect(page.getByRole("heading", { name: "Tutores" })).toBeVisible();
  await page.getByRole("link", { name: /Financeiro/ }).click();
  await expect(page.getByRole("heading", { name: "Financeiro" })).toBeVisible();
});
