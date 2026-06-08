import { expect, test } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "teste.admin@local.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "Teste@123456";

test.describe("Authentication experience", () => {
  test("renders the login page cleanly on mobile and desktop", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/login");

    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByLabel("Abrir navegação")).toHaveCount(0);
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1;
    });
    expect(hasOverflow).toBeFalsy();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();

    await expect(page.getByText("Acessar a base")).toBeVisible();
    await expect(page.getByText("Portal operacional")).toBeVisible();
  });

  test("allows a seeded admin to log in and land on the dashboard", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/login");

    await page.locator("#email").fill(adminEmail);
    await page.locator("#password").fill(adminPassword);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /Um painel claro/i })).toBeVisible();
    await expect(page.getByText("Visão executiva")).toBeVisible();
  });
});
