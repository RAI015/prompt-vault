import { type Page, expect } from "@playwright/test";
import { PV_SELECTORS } from "../../../src/constants/ui-selectors";

const testUserEmail = process.env.TEST_USER_EMAIL;
const testUserPassword = process.env.TEST_USER_PASSWORD;

export const loginAsTestUser = async (page: Page): Promise<void> => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(testUserEmail ?? "");
  await page.getByLabel("パスワード").fill(testUserPassword ?? "");
  await page.getByRole("button", { name: "メールでログイン" }).click();
  await page.waitForURL("**/app/prompts", { timeout: 10_000 });
  await expect(page.getByTestId(PV_SELECTORS.createButton)).toBeVisible({ timeout: 10_000 });
};
