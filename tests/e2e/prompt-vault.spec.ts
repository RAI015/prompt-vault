import { expect, test } from "@playwright/test";

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

    await page.getByTestId("pv-create-button").click();
    await page.getByTestId("pv-title-input").fill(title);
    await page.getByTestId("pv-body-input").fill(body);
    await page.getByTestId("pv-tags-input").fill("e2e, test");
    await page.getByTestId("pv-save-button").click();

    await expect(page.getByTestId("pv-selected-title")).toHaveText(title);
    await expect(page.getByTestId("pv-placeholder-input-JOB_DESC")).toBeVisible();
    await expect(
      page.getByTestId("pv-search-result-item").filter({ hasText: title }),
    ).toBeVisible();

    await page.getByTestId("pv-placeholder-input-JOB_DESC").fill("フロントエンド開発");
    await page.getByTestId("pv-placeholder-input-LOGS").fill("エラーログA");

    await expect(page.getByTestId("pv-rendered-output")).toContainText("求人: フロントエンド開発");
    await expect(page.getByTestId("pv-rendered-output")).toContainText("ログ: エラーログA");

    await page.getByTestId("pv-copy-body").click();
    await expect(page.getByTestId("pv-toast-success")).toContainText("本文をコピーしました");
  });
});
