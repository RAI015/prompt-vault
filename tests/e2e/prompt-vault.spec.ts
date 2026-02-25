import { expect, test } from "@playwright/test";
import {
  PV_SELECTORS,
  getPlaceholderInputSelector,
  getPlaceholderLogActionSelector,
  getPlaceholderLogLineCountSelector,
} from "../../src/constants/ui-selectors";

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

  test("error_log の入力欄でログ短縮ボタンとUndoが使える", async ({ page }) => {
    const unique = Date.now();
    const title = `E2E Error Log ${unique}`;
    const body = "調査用ログ\\n{{error_log}}";
    const fullLog = Array.from({ length: 120 }, (_, index) => `line-${index + 1}`).join("\n");
    const head50 = Array.from({ length: 50 }, (_, index) => `line-${index + 1}`).join("\n");

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(testUserEmail ?? "");
    await page.getByLabel("パスワード").fill(testUserPassword ?? "");
    await page.getByRole("button", { name: "メールでログイン" }).click();

    await expect(page.getByText("Prompt Vault")).toBeVisible();

    await page.getByTestId(PV_SELECTORS.createButton).click();
    await page.getByTestId(PV_SELECTORS.titleInput).fill(title);
    await page.getByTestId(PV_SELECTORS.bodyInput).fill(body);
    await page.getByTestId(PV_SELECTORS.tagsInput).fill("e2e, error-log");
    await page.getByTestId(PV_SELECTORS.saveButton).click();

    const placeholderKey = "error_log";
    const logInput = page.getByTestId(getPlaceholderInputSelector(placeholderKey));
    const lineCount = page.getByTestId(getPlaceholderLogLineCountSelector(placeholderKey));
    const headButton = page.getByTestId(getPlaceholderLogActionSelector(placeholderKey, "head"));
    const undoButton = page.getByTestId(getPlaceholderLogActionSelector(placeholderKey, "undo"));

    await expect(logInput).toBeVisible();
    await expect(headButton).toBeVisible();
    await expect(undoButton).toBeDisabled();

    await logInput.fill(fullLog);
    await expect(lineCount).toHaveText("行数: 120");

    await headButton.click();
    await expect(logInput).toHaveValue(head50);
    await expect(lineCount).toHaveText("行数: 50");
    await expect(undoButton).toBeEnabled();

    await undoButton.click();
    await expect(logInput).toHaveValue(fullLog);
    await expect(lineCount).toHaveText("行数: 120");
    await expect(undoButton).toBeDisabled();
  });
});
