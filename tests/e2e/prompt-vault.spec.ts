import { expect, test } from "@playwright/test";

const testUserEmail = process.env.TEST_USER_EMAIL;
const testUserPassword = process.env.TEST_USER_PASSWORD;

test.describe("Prompt Vault E2E", () => {
  test.beforeEach(() => {
    if (!testUserEmail || !testUserPassword) {
      throw new Error("TEST_USER_EMAIL and TEST_USER_PASSWORD are required");
    }
  });

  test("メール認証でログインしてPromptを作成し、置換とコピーを確認する", async ({ page }) => {
    const unique = Date.now();
    const title = `E2E Prompt ${unique}`;
    const body = "求人: {{JOB_DESC}}\\nログ: {{LOGS}}";

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(testUserEmail ?? "");
    await page.getByLabel("パスワード").fill(testUserPassword ?? "");
    await page.getByRole("button", { name: "メールでログイン" }).click();

    await expect(page.getByText("Prompt Vault")).toBeVisible();

    await page.getByRole("button", { name: "新規作成" }).click();
    await page.getByLabel("タイトル").fill(title);
    await page.getByLabel("本文").fill(body);
    await page.getByLabel("タグ（カンマ区切り）").fill("e2e, test");
    await page.getByRole("button", { name: "保存" }).click();

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText("{{JOB_DESC}}", { exact: false })).toBeVisible();

    await page.getByLabel("{{JOB_DESC}}").fill("フロントエンド開発");
    await page.getByLabel("{{LOGS}}").fill("エラーログA");

    await expect(page.getByText("求人: フロントエンド開発")).toBeVisible();
    await expect(page.getByText("ログ: エラーログA")).toBeVisible();

    await page.getByRole("button", { name: "コピー" }).click();
    await expect(page.getByText("コピーしました")).toBeVisible();
  });
});
