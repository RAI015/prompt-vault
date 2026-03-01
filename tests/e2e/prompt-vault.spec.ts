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
    const body = "求人: {{JOB_DESC}}\\nログ: {{error_logs}}";

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
    await expect(page.getByTestId(getPlaceholderInputSelector("error_logs"))).toHaveAttribute(
      "placeholder",
      "エラーログを貼り付け",
    );
    await expect(
      page.getByTestId(getPlaceholderLogActionSelector("error_logs", "head")),
    ).toBeVisible();

    await page.getByTestId(getPlaceholderInputSelector("JOB_DESC")).fill("フロントエンド開発");
    await page.getByTestId(getPlaceholderInputSelector("error_logs")).fill("エラーログA");

    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText(
      "求人: フロントエンド開発",
    );
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("ログ: エラーログA");

    await page.getByTestId(PV_SELECTORS.clearPlaceholdersButton).click();
    await expect(page.getByTestId(getPlaceholderInputSelector("JOB_DESC"))).toHaveValue("");
    await expect(page.getByTestId(getPlaceholderInputSelector("error_logs"))).toHaveValue("");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).not.toContainText(
      "フロントエンド開発",
    );
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).not.toContainText("エラーログA");

    await page.getByTestId(PV_SELECTORS.copyBodyButton).click();
    await expect(page.getByTestId(PV_SELECTORS.toastSuccess)).toContainText("本文をコピーしました");
  });

  test("error_logs の入力欄でログ短縮ボタンとUndoが使える", async ({ page }) => {
    const unique = Date.now();
    const title = `E2E Error Log ${unique}`;
    const body = "調査用ログ\\n{{error_logs}}";
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
    await page.getByTestId(PV_SELECTORS.tagsInput).fill("e2e, error-logs");
    await page.getByTestId(PV_SELECTORS.saveButton).click();

    const placeholderKey = "error_logs";
    const logInput = page.getByTestId(getPlaceholderInputSelector(placeholderKey));
    const lineCount = page.getByTestId(getPlaceholderLogLineCountSelector(placeholderKey));
    const headButton = page.getByTestId(getPlaceholderLogActionSelector(placeholderKey, "head"));
    const undoButton = page.getByTestId(getPlaceholderLogActionSelector(placeholderKey, "undo"));

    await expect(logInput).toBeVisible();
    await expect(logInput).toHaveAttribute("placeholder", "エラーログを貼り付け");
    await expect(page.getByLabel("エラーログ")).toBeVisible();
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
    await page.setViewportSize({ width: 1280, height: 620 });

    await expect(page.getByText("DEMO（閲覧のみ）")).toBeVisible();
    await expect(page.getByRole("link", { name: "ログインして使う" })).toBeVisible();

    await expect(page.getByTestId(PV_SELECTORS.leftPane)).toBeVisible();
    await expect(page.getByRole("heading", { name: "プレースホルダ入力" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "レンダリング結果" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: "元の文章" })).toHaveAttribute(
      "aria-selected",
      "false",
    );

    const key = "goal_text";
    const input = page.getByTestId(getPlaceholderInputSelector(key));
    const errorLogsInput = page.getByTestId(getPlaceholderInputSelector("error_logs"));
    const fillExampleButton = page.getByTestId(PV_SELECTORS.fillPlaceholderExamplesButton);
    const placeholderSection = page.locator("section", {
      has: page.getByRole("heading", { name: "プレースホルダ入力" }),
    });
    const placeholderScrollArea = placeholderSection.locator("div.overflow-auto").first();
    const renderedPanel = page.locator("#preview-rendered-panel");
    const originalPanel = page.locator("#preview-original-panel");
    const originalScrollArea = originalPanel.locator("div.overflow-auto").first();
    const errorLogsExample = [
      "PrismaClientInitializationError: Can't reach database server at `db.example.supabase.co:5432`",
      "",
      "Environment:",
      "- local (pnpm dev)",
      "- Node: 20.x",
      "- OS: macOS",
      "",
      "Steps tried:",
      "- nslookup db.example.supabase.co -> No answer",
      "- Retry with DNS 1.1.1.1 -> OK",
    ].join("\n");
    await expect(input).toBeVisible();
    await expect(page.getByLabel("エラーログ")).toBeVisible();
    await expect(errorLogsInput).toHaveAttribute("placeholder", "エラーログを貼り付け");
    await expect(fillExampleButton).toBeVisible();
    await expect(page.getByTestId(PV_SELECTORS.clearPlaceholdersButton)).toHaveCount(1);
    await expect(renderedPanel).toBeVisible();
    await expect(originalPanel).toBeHidden();

    const initialPreviewScrollTop = await originalScrollArea.evaluate(
      (element) => element.scrollTop,
    );
    const placeholderScrollTop = await placeholderScrollArea.evaluate((element) => {
      element.scrollTop = 120;
      return element.scrollTop;
    });
    expect(placeholderScrollTop).toBeGreaterThan(0);
    await expect(page.getByRole("tab", { name: "レンダリング結果" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: "元の文章" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    const previewScrollTopAfterLeftScroll = await originalScrollArea.evaluate(
      (element) => element.scrollTop,
    );
    expect(previewScrollTopAfterLeftScroll).toBe(initialPreviewScrollTop);

    await page.getByRole("tab", { name: "元の文章" }).click();
    await expect(renderedPanel).toBeHidden();
    await expect(originalPanel).toBeVisible();
    const leftScrollTopBeforePreviewScroll = await placeholderScrollArea.evaluate(
      (element) => element.scrollTop,
    );
    const previewScrollTop = await originalScrollArea.evaluate((element) => {
      element.scrollTop = 120;
      return element.scrollTop;
    });
    expect(previewScrollTop).toBeGreaterThan(0);
    const leftScrollTopAfterPreviewScroll = await placeholderScrollArea.evaluate(
      (element) => element.scrollTop,
    );
    expect(leftScrollTopAfterPreviewScroll).toBe(leftScrollTopBeforePreviewScroll);
    await page.getByRole("tab", { name: "レンダリング結果" }).click();
    await expect(renderedPanel).toBeVisible();
    await expect(originalPanel).toBeHidden();

    await input.fill("E2Eデモ入力");
    await fillExampleButton.click();
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("E2Eデモ入力");
    await expect(errorLogsInput).toHaveValue(errorLogsExample);
    await expect(input).toHaveValue("E2Eデモ入力");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText(errorLogsExample);

    await page.getByRole("tab", { name: "元の文章" }).click();
    await expect(page.getByRole("tab", { name: "元の文章" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(originalPanel).toContainText("{{goal_text}}");
    await expect(originalPanel).toContainText("{{error_logs}}");

    await page.getByRole("tab", { name: "レンダリング結果" }).click();
    await expect(page.getByRole("tab", { name: "レンダリング結果" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.reload();
    await expect(page.getByTestId(getPlaceholderInputSelector(key))).toHaveValue("E2Eデモ入力");
    await expect(errorLogsInput).toHaveValue(errorLogsExample);

    await page.getByTestId(PV_SELECTORS.clearPlaceholdersButton).click();
    await errorLogsInput.fill("手入力ログ");
    await expect(fillExampleButton).toBeDisabled();
    await expect(errorLogsInput).toHaveValue("手入力ログ");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("手入力ログ");

    await page.reload();
    await expect(page.getByTestId(getPlaceholderInputSelector(key))).toHaveValue("");
    await expect(errorLogsInput).toHaveValue("手入力ログ");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("手入力ログ");

    // 禁止操作がUIに出ていない（消した前提）
    await expect(page.getByTestId(PV_SELECTORS.createButton)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "ログアウト" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "編集" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "保存" })).toHaveCount(0);
  });

  test("pin したプロンプトが先頭に並び、demo では pin ボタンが表示されない", async ({ page }) => {
    const unique = Date.now();
    const titleA = `Pin A ${unique}`;
    const titleB = `Pin B ${unique}`;
    const body = "pin test body";

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(testUserEmail ?? "");
    await page.getByLabel("パスワード").fill(testUserPassword ?? "");
    await page.getByRole("button", { name: "メールでログイン" }).click();

    await expect(page.getByText("Prompt Vault")).toBeVisible();

    await page.getByTestId(PV_SELECTORS.createButton).click();
    await page.getByTestId(PV_SELECTORS.titleInput).fill(titleA);
    await page.getByTestId(PV_SELECTORS.bodyInput).fill(body);
    await page.getByTestId(PV_SELECTORS.tagsInput).fill("e2e, pin");
    await page.getByTestId(PV_SELECTORS.saveButton).click();
    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(titleA);

    await page.getByTestId(PV_SELECTORS.createButton).click();
    await page.getByTestId(PV_SELECTORS.titleInput).fill(titleB);
    await page.getByTestId(PV_SELECTORS.bodyInput).fill(body);
    await page.getByTestId(PV_SELECTORS.tagsInput).fill("e2e, pin");
    await page.getByTestId(PV_SELECTORS.saveButton).click();
    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(titleB);

    const itemB = page.getByTestId(PV_SELECTORS.searchResultItem).filter({ hasText: titleB });
    await itemB.getByTestId(PV_SELECTORS.searchResultPinButton).click();
    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(titleB);
    await page.getByTestId(PV_SELECTORS.searchInput).fill(String(unique));

    const itemsAfterPinB = page.getByTestId(PV_SELECTORS.searchResultItem);
    await expect(itemsAfterPinB).toHaveCount(2, { timeout: 10_000 });
    await expect(itemsAfterPinB.nth(0)).toContainText(titleB);

    const itemA = page.getByTestId(PV_SELECTORS.searchResultItem).filter({ hasText: titleA });
    await itemA.click();
    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(titleA);
    await itemA.getByTestId(PV_SELECTORS.searchResultPinButton).click();
    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(titleA);

    const itemsAfterPinA = page.getByTestId(PV_SELECTORS.searchResultItem);
    await expect(itemsAfterPinA).toHaveCount(2, { timeout: 10_000 });
    await expect(itemsAfterPinA.nth(0)).toContainText(titleA);
    await expect(itemsAfterPinA.nth(1)).toContainText(titleB);

    await page.goto("/demo");
    await expect(page.getByTestId(PV_SELECTORS.searchResultPinButton)).toHaveCount(0);
  });
});
