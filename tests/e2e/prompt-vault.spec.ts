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
    await expect(page.getByTestId(getPlaceholderInputSelector("LOGS"))).toHaveAttribute(
      "placeholder",
      "複数行の入力に対応",
    );

    await page.getByTestId(getPlaceholderInputSelector("JOB_DESC")).fill("フロントエンド開発");
    await page.getByTestId(getPlaceholderInputSelector("LOGS")).fill("エラーログA");

    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText(
      "求人: フロントエンド開発",
    );
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("ログ: エラーログA");

    await page.getByTestId(PV_SELECTORS.clearPlaceholdersButton).click();
    await expect(page.getByTestId(getPlaceholderInputSelector("JOB_DESC"))).toHaveValue("");
    await expect(page.getByTestId(getPlaceholderInputSelector("LOGS"))).toHaveValue("");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).not.toContainText(
      "フロントエンド開発",
    );
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).not.toContainText("エラーログA");

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
    await expect(logInput).toHaveAttribute("placeholder", "Paste error log here...");
    await expect(page.getByLabel("Error log")).toBeVisible();
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

  test("左ペインの幅をドラッグで変更できる", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(testUserEmail ?? "");
    await page.getByLabel("パスワード").fill(testUserPassword ?? "");
    await page.getByRole("button", { name: "メールでログイン" }).click();
    await expect(page.getByText("Prompt Vault")).toBeVisible();

    const leftPane = page.getByTestId(PV_SELECTORS.leftPane);
    const handle = page.getByTestId(PV_SELECTORS.splitterHandle);

    const before = await leftPane.boundingBox();
    if (!before) throw new Error("leftPane boundingBox is null");

    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error("splitterHandle boundingBox is null");

    // ハンドル中央をつかんで右へドラッグ
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 120, handleBox.y + handleBox.height / 2);
    await page.mouse.up();

    const after = await leftPane.boundingBox();
    if (!after) throw new Error("leftPane boundingBox is null");

    expect(after.width).toBeGreaterThan(before.width);
  });

  test("DEMO: 閲覧できて、置換が反映され、禁止操作が表示されない", async ({ page }) => {
    await page.goto("/demo");

    await expect(page.getByText("DEMO（閲覧のみ）")).toBeVisible();
    await expect(page.getByRole("link", { name: "ログインして使う" })).toBeVisible();

    await expect(page.getByTestId(PV_SELECTORS.leftPane)).toBeVisible();

    const key = "goal_text";
    const input = page.getByTestId(getPlaceholderInputSelector(key));
    await expect(input).toBeVisible();
    await expect(page.getByLabel("Error logs")).toBeVisible();
    await expect(page.getByTestId(getPlaceholderInputSelector("error_logs"))).toHaveAttribute(
      "placeholder",
      "Paste error logs here...",
    );

    await input.fill("E2Eデモ入力");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("E2Eデモ入力");

    // 禁止操作がUIに出ていない（消した前提）
    await expect(page.getByTestId(PV_SELECTORS.createButton)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ログアウト" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "編集" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "保存" })).toHaveCount(0);
  });
});
