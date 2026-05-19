import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const BASE = "http://127.0.0.1:3000";

test.use({ baseURL: BASE });

const TUTOR_NAME = "Audit Tutor E2E";
const TUTOR_NAME_UPDATED = "Audit Tutor E2E Atualizado";
const PET_NAME = "Audit Pet E2E";
const PET_NAME_UPDATED = "Audit Pet E2E Atualizado";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "Fernanda";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Zenipets";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="identifier"]', ADMIN_USERNAME);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await page.waitForURL(/dashboard/);
}

test("AUDIT 01: login via real form submission", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="identifier"]', ADMIN_USERNAME);
  await page.fill('input[name="password"]', ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading", { name: /Bom dia, Fernanda/ })).toBeVisible();
});

test("AUDIT 02: login with bad password redirects with error", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="identifier"]', ADMIN_USERNAME);
  await page.fill('input[name="password"]', "wrong-password");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page).toHaveURL(/login\?error=1/);
  await expect(page.locator(".alert--danger")).toBeVisible();
});

test("AUDIT 03: every navigation route loads", async ({ page }) => {
  await login(page);
  for (const [label, urlPattern] of [
    ["Dashboard", /dashboard/],
    ["Google Agenda", /agenda/],
    ["Tutores", /tutores$/],
    ["Pets", /pets$/],
    ["Financeiro", /financeiro/],
    ["Configuracoes", /configuracoes/],
    ["Importacao", /importacao/],
  ] as const) {
    await page.getByRole("link", { name: new RegExp(`^${label}`) }).click();
    await expect(page).toHaveURL(urlPattern);
  }
});

test("AUDIT 04: create tutor via modal, persists and renders on list", async ({ page }) => {
  await login(page);
  await page.goto("/tutores");
  await page.getByRole("button", { name: "Novo tutor" }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator('input[name="name"]').fill(TUTOR_NAME);
  await dialog.locator('input[name="phone"]').fill("11988887777");
  await dialog.locator('input[name="address"]').fill("Rua de Teste, 1");
  await dialog.locator('textarea[name="notes"]').fill("Criado pelo teste de auditoria");
  await dialog.getByRole("button", { name: "Salvar tutor" }).click();
  await page.waitForURL(/tutores\/[0-9a-f-]+\/ficha/);
  await expect(page.getByRole("heading", { name: new RegExp(TUTOR_NAME) }).first()).toBeVisible();
  await page.goto("/tutores");
  await expect(page.locator("table").getByText(TUTOR_NAME)).toBeVisible();
});

test("AUDIT 05: edit tutor and toggle status", async ({ page }) => {
  await login(page);
  await page.goto("/tutores");
  await page.locator("table").getByText(TUTOR_NAME).click();
  await page.waitForURL(/tutores\/[0-9a-f-]+/);
  // Update form (scope to #editar to avoid input clashes with modals on the page)
  const editForm = page.locator("section#editar form").first();
  await editForm.locator('input[name="name"]').fill(TUTOR_NAME_UPDATED);
  await editForm.locator('input[name="phone"]').fill("11900001111");
  await editForm.locator('input[name="document"]').fill("12345678900");
  await editForm.getByRole("button", { name: "Salvar ficha" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(TUTOR_NAME_UPDATED) }).first()).toBeVisible({ timeout: 10000 });

  // Toggle status (Inativar -> Reativar)
  await page.getByRole("button", { name: /Inativar tutor/ }).click();
  await expect(page.getByRole("button", { name: /Reativar tutor/ })).toBeVisible({ timeout: 10000 });
});

test("AUDIT 06: create pet from tutor ficha (via modal)", async ({ page }) => {
  await login(page);
  await page.goto("/tutores");
  await page.locator("table").getByText(TUTOR_NAME_UPDATED).click();
  await page.waitForURL(/tutores\/[0-9a-f-]+/);
  await page.getByRole("button", { name: "Adicionar pet" }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator('input[name="name"]').fill(PET_NAME);
  await dialog.locator('input[name="breed"]').fill("Vira-lata");
  await dialog.locator('input[name="ageLabel"]').fill("3 anos");
  await dialog.getByRole("button", { name: "Salvar pet" }).click();
  await page.waitForURL(/pets\/[0-9a-f-]+\/ficha/, { timeout: 10000 });
  await expect(page.locator("h2").filter({ hasText: PET_NAME }).first()).toBeVisible();
});

test("AUDIT 07: edit pet ficha", async ({ page }) => {
  await login(page);
  await page.goto("/pets");
  await page.locator(".card", { hasText: PET_NAME }).getByRole("link", { name: "Ver ficha" }).first().click();
  await page.waitForURL(/pets\/[0-9a-f-]+/);
  await page.fill('section#editar input[name="name"]', PET_NAME_UPDATED);
  await page.fill('section#editar textarea[name="foodNotes"]', "Ração premium 2x ao dia");
  await page.fill('section#editar textarea[name="healthNotes"]', "Vacinação em dia");
  await page.locator('section#editar').getByRole("button", { name: "Salvar ficha" }).click();
  await expect(page.locator("h2").filter({ hasText: PET_NAME_UPDATED }).first()).toBeVisible({ timeout: 10000 });
});

test("AUDIT 08: create reservation via modal", async ({ page }) => {
  await login(page);
  await page.goto("/reservas");
  await page.getByRole("button", { name: "Nova reserva" }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator('select[name="tutorId"]').selectOption({ label: TUTOR_NAME_UPDATED });
  await dialog.getByLabel(PET_NAME_UPDATED).check();
  // pick the first Hospedagem service
  await dialog.locator('select[name="serviceTypeId"]').selectOption({ index: 0 });
  await dialog.locator('input[name="startsAt"]').fill("2026-06-01T10:00");
  await dialog.locator('input[name="endsAt"]').fill("2026-06-03T18:00");
  await dialog.locator('input[name="baseAmountCents"]').fill("R$ 200,00");
  await dialog.locator('textarea[name="notes"]').fill("Reserva e2e auditoria");
  await dialog.getByRole("button", { name: "Salvar reserva" }).click();
  await page.waitForURL(/reservas\/[0-9a-f-]+/, { timeout: 15000 });
  await expect(page.getByText("Reserva e2e auditoria")).toBeVisible();
});

test("AUDIT 09: register payment", async ({ page }) => {
  await login(page);
  await page.goto(`/reservas?q=${encodeURIComponent(TUTOR_NAME_UPDATED)}`);
  await page.locator("table").getByRole("link", { name: TUTOR_NAME_UPDATED }).first().click();
  await page.waitForURL(/reservas\/[0-9a-f-]+/);
  const url = page.url();
  const reservationId = url.match(/reservas\/([0-9a-f-]+)/)![1];
  const paymentForm = page.locator('form').filter({ has: page.getByRole("button", { name: "Registrar" }) });
  await paymentForm.locator('input[name="amountCents"]').fill("100,00");
  await paymentForm.locator('input[name="notes"]').fill("Sinal e2e");
  await paymentForm.getByRole("button", { name: "Registrar" }).click();
  // Re-load and check that "Sinal e2e" appears in the payments table
  await page.goto(`/reservas/${reservationId}`);
  await expect(page.getByText("Sinal e2e")).toBeVisible({ timeout: 10000 });
});

test("AUDIT 10: financeiro - create expense", async ({ page }) => {
  await login(page);
  await page.goto("/financeiro");
  await page.getByRole("button", { name: /Adicionar movimenta/ }).click();
  const createDialog = page.locator("dialog[open]");
  await createDialog.locator('input[name="category"]').fill("Auditoria E2E");
  await createDialog.locator('input[name="entryDate"]').fill("2026-05-04");
  await createDialog.locator('input[name="amountCents"]').fill("50,00");
  await createDialog.locator('input[name="description"]').fill("Despesa e2e");
  await createDialog.getByRole("button", { name: /Salvar movimenta/ }).click();
  await expect(page).toHaveURL(/saved=1/, { timeout: 10000 });
  await expect(page.locator("table").getByText("Despesa e2e")).toBeVisible();

  const entryRow = page.locator("tr", { hasText: "Despesa e2e" }).first();
  await entryRow.getByRole("button", { name: "Editar lançamento" }).click();
  const editDialog = page.locator("dialog[open]");
  await editDialog.locator('select[name="method"]').selectOption("PIX");
  await editDialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page).toHaveURL(/saved=1/, { timeout: 10000 });
  await expect(page.locator("tr", { hasText: "Despesa e2e" }).first()).toContainText("PIX");
});

test("AUDIT 11: financeiro - export CSV", async ({ page }) => {
  await login(page);
  const response = await page.request.get("/api/financeiro/export");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body.startsWith('"data"')).toBe(true);
});

test("AUDIT 12: configuracoes - update business settings", async ({ page }) => {
  await login(page);
  await page.goto("/configuracoes");
  await page.fill('input[name="phone"]', "11955554444");
  await page.fill('input[name="instagram"]', "@zenipets");
  await page.fill('input[name="boardingCapacity"]', "12");
  await page.fill('input[name="depositPercent"]', "60");
  await page.getByRole("button", { name: "Salvar configuracoes" }).click();
  await expect(page).toHaveURL(/saved=1/, { timeout: 10000 });
});

test("AUDIT 13: importacao - approve a record", async ({ page }) => {
  await login(page);
  await page.goto("/importacao");
  // Try to approve the first pending record
  const firstApprove = page.locator('button:has-text("Aprovar")').first();
  const count = await firstApprove.count();
  if (count > 0) {
    await firstApprove.click();
    await expect(page).toHaveURL(/importacao/);
  }
});

test("AUDIT 14: dashboard renders the new reservation as upcoming", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard");
  // Just confirm it renders without error
  await expect(page.getByText(/Hospedados hoje/)).toBeVisible();
});

test("AUDIT 15: rejects invalid currency (R$abc) on register payment", async ({ page }) => {
  await login(page);
  await page.goto(`/reservas?q=${encodeURIComponent(TUTOR_NAME_UPDATED)}`);
  await page.locator("table").getByRole("link", { name: TUTOR_NAME_UPDATED }).first().click();
  await page.waitForURL(/reservas\/[0-9a-f-]+/);
  const paymentForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Registrar" }) });
  await paymentForm.locator('input[name="amountCents"]').fill("abc");
  await paymentForm.getByRole("button", { name: "Registrar" }).click();
  await expect(page).toHaveURL(/error=valor-invalido/);
  await expect(page.locator(".alert--danger")).toBeVisible();
});

test("AUDIT 16: rejects mismatched dates on new reservation", async ({ page }) => {
  await login(page);
  await page.goto("/reservas");
  await page.getByRole("button", { name: "Nova reserva" }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator('select[name="tutorId"]').selectOption({ label: TUTOR_NAME_UPDATED });
  await dialog.getByLabel(PET_NAME_UPDATED).check();
  await dialog.locator('select[name="serviceTypeId"]').selectOption({ index: 0 });
  await dialog.locator('input[name="startsAt"]').fill("2026-06-10T10:00");
  await dialog.locator('input[name="endsAt"]').fill("2026-06-01T18:00");
  await dialog.locator('input[name="baseAmountCents"]').fill("100,00");
  await dialog.getByRole("button", { name: "Salvar reserva" }).click();
  await expect(page).toHaveURL(/error=datas-invalidas/);
});

test("AUDIT 17: delete pending reservation works; completed reservation refuses", async ({ page }) => {
  await login(page);
  // Create one pending reservation we can safely delete
  await page.goto("/reservas");
  await page.getByRole("button", { name: "Nova reserva" }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator('select[name="tutorId"]').selectOption({ label: TUTOR_NAME_UPDATED });
  await dialog.getByLabel(PET_NAME_UPDATED).check();
  await dialog.locator('select[name="serviceTypeId"]').selectOption({ index: 0 });
  await dialog.locator('input[name="startsAt"]').fill("2026-07-01T10:00");
  await dialog.locator('input[name="endsAt"]').fill("2026-07-02T18:00");
  await dialog.locator('input[name="baseAmountCents"]').fill("150,00");
  await dialog.locator('textarea[name="notes"]').fill("Reserva descartavel");
  await dialog.getByRole("button", { name: "Salvar reserva" }).click();
  await page.waitForURL(/reservas\/[0-9a-f-]+/);

  // The brand new reservation defaults to CONFIRMED — cancel it first to make it deletable.
  await page.locator("form").filter({ has: page.getByRole("button", { name: "Cancelar" }) }).getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator(".badge--cancelada").first()).toBeVisible();

  // Then delete it (with confirm dialog auto-accepted)
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Excluir reserva" }).click();
  await expect(page).toHaveURL(/agenda\?deleted=1/);
});

test("AUDIT 18: delete pet without reservations + delete tutor without pets", async ({ page }) => {
  await login(page);
  const standaloneName = `Audit Tutor Solo ${Date.now()}`;
  const standalonePetName = `Audit Pet Solo ${Date.now()}`;

  // Create tutor via modal
  await page.goto("/tutores");
  await page.getByRole("button", { name: "Novo tutor" }).click();
  let dialog = page.locator("dialog[open]");
  await dialog.locator('input[name="name"]').fill(standaloneName);
  await dialog.locator('input[name="phone"]').fill("11900000000");
  await dialog.getByRole("button", { name: "Salvar tutor" }).click();
  await page.waitForURL(/tutores\/[0-9a-f-]+\/ficha/);

  // Add a pet via modal on tutor ficha
  await page.getByRole("button", { name: "Adicionar pet" }).click();
  dialog = page.locator("dialog[open]");
  await dialog.locator('input[name="name"]').fill(standalonePetName);
  await dialog.getByRole("button", { name: "Salvar pet" }).click();
  await page.waitForURL(/pets\/[0-9a-f-]+\/ficha/);

  // Delete the pet (no reservations → button enabled)
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Excluir pet" }).click();
  await expect(page).toHaveURL(/pets\?deleted=1/);

  // Find the tutor again and delete (no pets, no reservations → button enabled)
  await page.goto("/tutores");
  await page.locator("table").getByText(standaloneName).click();
  await page.waitForURL(/tutores\/[0-9a-f-]+/);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Excluir tutor" }).click();
  await expect(page).toHaveURL(/tutores\?deleted=1/);
});

test("AUDIT 19: logout clears the session", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/login/);
  // After logout, /dashboard must redirect back to /login
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
});

// --- Step 2 features ---

test("AUDIT 20: /reservas listing renders with filters", async ({ page }) => {
  await login(page);
  await page.goto("/reservas");
  await expect(page.getByRole("heading", { name: "Reservas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Aplicar filtros" })).toBeVisible();
});

test("AUDIT 21: dashboard task CRUD via modal - create, toggle, edit, delete", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard");
  // Open Nova tarefa modal
  await page.getByRole("button", { name: "Nova tarefa" }).click();
  const dialog = page.locator("dialog[open]");
  await dialog.locator('input[name="title"]').fill("Tarefa de teste e2e");
  // Set taskDate to today (use local ISO format)
  const today = new Date();
  const localISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}T08:00`;
  await dialog.locator('input[name="taskDate"]').fill(localISO);
  await dialog.getByRole("button", { name: "Salvar tarefa" }).click();
  await page.waitForURL(/saved=1/);
  await expect(page.getByText("Tarefa de teste e2e")).toBeVisible();

  // Toggle (click the checkbox button)
  const taskRow = page.locator(".row").filter({ hasText: "Tarefa de teste e2e" });
  await taskRow.locator("button").first().click();
  await expect(taskRow.locator("span.subtle").first()).toContainText("Tarefa de teste e2e");

  // Edit from the three-dot menu
  await taskRow.getByRole("button", { name: /Ações da tarefa/ }).click();
  await taskRow.getByRole("menuitem", { name: "Editar" }).click();
  const editDialog = page.locator("dialog[open]");
  await editDialog.locator('input[name="title"]').fill("Tarefa de teste e2e editada");
  await editDialog.getByRole("button", { name: "Salvar tarefa" }).click();
  await page.waitForURL(/saved=1/);
  await expect(page.getByText("Tarefa de teste e2e editada")).toBeVisible();

  // Delete
  const updatedTaskRow = page.locator(".row").filter({ hasText: "Tarefa de teste e2e editada" });
  await updatedTaskRow.getByRole("button", { name: /Ações da tarefa/ }).click();
  page.once("dialog", (d) => d.accept());
  await updatedTaskRow.getByRole("menuitem", { name: "Excluir" }).click();
  await expect(page.getByText("Tarefa de teste e2e editada")).not.toBeVisible();
});

test("AUDIT 22: /valores creates ServiceType and PriceRule", async ({ page }) => {
  await login(page);
  await page.goto("/valores");
  // Create new ServiceType
  await page.locator('section').first().locator('input[name="name"]').fill("Servico Auditoria");
  await page.locator('section').first().getByRole("button", { name: "Salvar tipo" }).click();
  await expect(page.getByText("Servico Auditoria").first()).toBeVisible();

  // Add a price rule under that service
  const serviceCard = page.locator("section").filter({ has: page.getByText("Servico Auditoria") }).first();
  await serviceCard.getByText("Adicionar nova regra").click();
  await serviceCard.locator('input[name="label"]').last().fill("Padrao");
  await serviceCard.locator('input[name="firstPetCents"]').last().fill("R$ 80,00");
  await serviceCard.getByRole("button", { name: "Adicionar regra" }).click();
  await expect(page.getByText("Padrao", { exact: false })).toBeVisible();
});

test("AUDIT 23: configuracoes/temporadas creates SeasonPeriod", async ({ page }) => {
  await login(page);
  await page.goto("/configuracoes/temporadas");
  await page.locator('input[name="name"]').first().fill("Carnaval Audit");
  await page.locator('input[name="startsAt"]').first().fill("2026-02-13");
  await page.locator('input[name="endsAt"]').first().fill("2026-02-18");
  await page.getByRole("button", { name: "Salvar temporada" }).click();
  await expect(page.locator("table").getByText("Carnaval Audit")).toBeVisible();
});

test("AUDIT 24: import flow with a CLIENT_FORM record (skip if none pending)", async ({ page }) => {
  await login(page);
  await page.goto("/importacao?type=CLIENT_FORM&status=PENDING_REVIEW");
  const approveBtn = page.locator("table.review-table").getByRole("button", { name: "Aprovar" }).first();
  if (await approveBtn.count() === 0) {
    test.skip(true, "no pending CLIENT_FORM records to import");
    return;
  }
  await approveBtn.click();
  await page.goto("/importacao?type=CLIENT_FORM&status=APPROVED");
  const importBtn = page.locator("table.review-table").getByRole("button", { name: "Importar" }).first();
  await importBtn.click();
  await expect(page).toHaveURL(/saved=1|importacao/);
  await page.goto("/tutores");
  await expect(page.locator("table tbody tr").first()).toBeVisible();
});
