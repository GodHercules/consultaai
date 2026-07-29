import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL ?? "teste.admin@local.com";
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? "Teste@123456";

const widths = [320, 375, 430, 768, 1024, 1280, 1440, 1920];

async function login(page: Page) {
  await page.goto("/login");
  await page.locator("#email").fill(adminEmail);
  await page.locator("#password").fill(adminPassword);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("Responsive shell", () => {
  test("keeps the authenticated shell usable across common breakpoints", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 960 });
    await login(page);

    for (const width of widths) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto("/companies");

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      expect(hasOverflow).toBeFalsy();
    }
  });
});
