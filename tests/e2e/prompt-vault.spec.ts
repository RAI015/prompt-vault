import { expect, test } from "@playwright/test";
import { PV_SELECTORS, getPlaceholderInputSelector } from "../../src/constants/ui-selectors";

const testUserEmail = process.env.TEST_USER_EMAIL;
const testUserPassword = process.env.TEST_USER_PASSWORD;

test.describe("Prompt Vault E2E", () => {
  test("メール認証でログインしてプロンプトを作成し、置換とコピーを確認する", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (_text: string) => {} },
        configurable: true,
      });
    });

    const unique = Date.now();
    const title = `E2E Prompt ${unique}`;
    const body = "求人: {{JOB_DESC}}\\nログ: {{LOGS}}";

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(testUserEmail ?? "");
    await page.getByLabel("パスワード").fill(testUserPassword ?? "");
    await page.getByRole("button", { name: "メールでログイン" }).click();

    await expect(page.getByText("Prompt Vault")).toBeVisible();

    await page.getByTestId(PV_SELECTORS.createButton).click();
    await page.getByTestId(PV_SELECTORS.titleInput).fill(title);
    await page.getByTestId(PV_SELECTORS.bodyInput).fill(body);
    await page.getByTestId(PV_SELECTORS.tagsInput).fill("e2e, test");
    await page.getByTestId(PV_SELECTORS.saveButton).click();

    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(title);
    await expect(page.getByTestId(getPlaceholderInputSelector("JOB_DESC"))).toBeVisible();
    await expect(
      page.getByTestId(PV_SELECTORS.searchResultItem).filter({ hasText: title }),
    ).toBeVisible();

    await page.getByTestId(getPlaceholderInputSelector("JOB_DESC")).fill("フロントエンド開発");
    await page.getByTestId(getPlaceholderInputSelector("LOGS")).fill("エラーログA");

    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText(
      "求人: フロントエンド開発",
    );
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("ログ: エラーログA");

    await page.getByTestId(PV_SELECTORS.copyBodyButton).click();
    await expect(page.getByTestId(PV_SELECTORS.toastSuccess)).toContainText("本文をコピーしました");
  });
});
