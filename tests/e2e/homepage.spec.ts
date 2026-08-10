import { test, expect } from "@playwright/test";

test("homepage renders the lodge heading", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "KwaNomzi Boutique Lodge" })).toBeVisible();
});
