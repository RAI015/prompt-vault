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
    await page.waitForURL("**/app/prompts", { timeout: 10_000 });

    await expect(page.getByTestId(PV_SELECTORS.createButton)).toBeVisible({ timeout: 10_000 });

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
    await page.waitForURL("**/app/prompts", { timeout: 10_000 });

    await expect(page.getByTestId(PV_SELECTORS.createButton)).toBeVisible({ timeout: 10_000 });

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
    await page.waitForURL("**/app/prompts", { timeout: 10_000 });
    await expect(page.getByTestId(PV_SELECTORS.createButton)).toBeVisible({ timeout: 10_000 });

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

  test("プレースホルダ入力とレンダリング結果の幅をドラッグで変更できる", async ({ page }) => {
    await page.goto("/demo");
    await page.setViewportSize({ width: 1440, height: 900 });

    const placeholderPane = page.getByTestId(PV_SELECTORS.placeholderPane);
    const previewPane = page.getByTestId(PV_SELECTORS.previewPane);
    const handle = page.getByTestId(PV_SELECTORS.previewSplitterHandle);

    await expect(placeholderPane).toBeVisible();
    await expect(previewPane).toBeVisible();
    await expect(handle).toBeVisible();

    const placeholderBefore = await placeholderPane.boundingBox();
    if (!placeholderBefore) throw new Error("placeholderPane boundingBox is null");

    const previewBefore = await previewPane.boundingBox();
    if (!previewBefore) throw new Error("previewPane boundingBox is null");

    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error("previewSplitterHandle boundingBox is null");

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + 120, handleBox.y + handleBox.height / 2);
    await page.mouse.up();

    const placeholderAfter = await placeholderPane.boundingBox();
    if (!placeholderAfter) throw new Error("placeholderPane boundingBox is null");

    const previewAfter = await previewPane.boundingBox();
    if (!previewAfter) throw new Error("previewPane boundingBox is null");

    expect(placeholderAfter.width).toBeGreaterThan(placeholderBefore.width);
    expect(previewAfter.width).toBeLessThan(previewBefore.width);
  });

  test("DEMO: 閲覧できて、置換が反映され、禁止操作が表示されない", async ({ page }) => {
    const bugPromptTitle = "BUG切り分けテンプレ（最初の10分）";
    const configPromptTitle = "CONFIG：キー/設定どこ？（場所・手順）";
    const customService = "railway";

    await page.goto("/demo");
    await page.setViewportSize({ width: 1280, height: 620 });

    await expect(page.getByText("DEMO（閲覧のみ）")).toBeVisible();
    await expect(page.getByRole("link", { name: "ログインして使う" })).toBeVisible();

    await expect(page.getByTestId(PV_SELECTORS.leftPane)).toBeVisible();
    await expect(page.getByRole("heading", { name: "プレースホルダ入力" })).toBeVisible();
    await expect(page.getByTestId(PV_SELECTORS.previewTab)).toBeVisible();
    await expect(page.getByRole("tab", { name: "元の文章" })).toHaveCount(0);
    const key = "goal_text";
    const input = page.getByTestId(getPlaceholderInputSelector(key));
    const envSelect = page.getByTestId(getPlaceholderInputSelector("env"));
    const prioritySelect = page.getByTestId(getPlaceholderInputSelector("priority"));
    const errorLogsInput = page.getByTestId(getPlaceholderInputSelector("error_logs"));
    const fillExampleButton = page.getByTestId(PV_SELECTORS.fillPlaceholderExamplesButton);
    const placeholderScrollArea = page
      .getByTestId(PV_SELECTORS.placeholderPane)
      .locator("div.overflow-auto")
      .first();
    const renderedPanel = page.locator("#preview-rendered-panel");
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
    await expect(envSelect).toBeVisible();
    await expect(prioritySelect).toBeVisible();
    await expect(page.getByLabel("エラーログ")).toBeVisible();
    await expect(errorLogsInput).toHaveAttribute("placeholder", "エラーログを貼り付け");
    await expect(fillExampleButton).toBeVisible();
    await expect(page.getByTestId(PV_SELECTORS.clearPlaceholdersButton)).toHaveCount(1);
    await expect(renderedPanel).toBeVisible();
    await expect(page.getByTestId(PV_SELECTORS.copyBodyButton)).toBeVisible();
    await expect(page.getByTestId(PV_SELECTORS.copyMenuButton)).toBeVisible();
    await page.getByTestId(PV_SELECTORS.copyMenuButton).click();
    await expect(page.getByTestId(PV_SELECTORS.copyMarkdownButton)).toBeVisible();
    await expect(page.getByTestId(PV_SELECTORS.copyOriginalButton)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("{{goal_text}}");
    const placeholderScrollTop = await placeholderScrollArea.evaluate((element) => {
      element.scrollTop = 120;
      return element.scrollTop;
    });
    expect(placeholderScrollTop).toBeGreaterThan(0);

    await input.fill("E2Eデモ入力");
    await envSelect.click();
    await page.getByRole("option", { name: "stg" }).click();
    await prioritySelect.click();
    await page.getByRole("option", { name: "high" }).click();
    await fillExampleButton.click();
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("E2Eデモ入力");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).not.toContainText("{{goal_text}}");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("環境: stg");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("優先度: high");
    await expect(errorLogsInput).toHaveValue(errorLogsExample);
    await expect(input).toHaveValue("E2Eデモ入力");
    await expect(envSelect).toContainText("stg");
    await expect(prioritySelect).toContainText("high");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText(errorLogsExample);

    await page.reload();
    await expect(page.getByTestId(getPlaceholderInputSelector(key))).toHaveValue("E2Eデモ入力");
    await expect(page.getByTestId(getPlaceholderInputSelector("env"))).toContainText("stg");
    await expect(page.getByTestId(getPlaceholderInputSelector("priority"))).toContainText("high");
    await expect(errorLogsInput).toHaveValue(errorLogsExample);
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("環境: stg");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText("優先度: high");

    await page
      .getByTestId(PV_SELECTORS.searchResultItem)
      .filter({ hasText: configPromptTitle })
      .click();
    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(configPromptTitle);

    const serviceSelect = page.getByTestId(getPlaceholderInputSelector("service"));
    const serviceCustomInput = page.locator(
      `input[data-pv="${getPlaceholderInputSelector("service")}"]`,
    );
    await expect(serviceSelect).toBeVisible();
    await serviceSelect.click();
    await page.getByRole("option", { name: "other（その他）" }).click({ force: true });
    await expect(serviceCustomInput).toBeVisible();
    await serviceCustomInput.fill(customService);
    await expect(serviceCustomInput).toHaveValue(customService);
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText(customService);

    await page.reload();
    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(configPromptTitle);
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          return window.localStorage.getItem("pv:placeholders:demo");
        });
      })
      .toContain(`"service":"${customService}"`);
    await page
      .getByTestId(PV_SELECTORS.searchResultItem)
      .filter({ hasText: bugPromptTitle })
      .click();
    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(bugPromptTitle);
    await expect(page.getByTestId(getPlaceholderInputSelector(key))).toHaveValue("");
    await expect(errorLogsInput).toHaveValue("");
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

  test("DEMO: コピー履歴を保存・ロードでき、正規化とリロード保持が効く", async ({ page }) => {
    const bugPromptTitle = "BUG切り分けテンプレ（最初の10分）";
    const configPromptTitle = "CONFIG：キー/設定どこ？（場所・手順）";
    const key = "goal_text";
    const firstValue = "履歴テスト入力";
    const normalizedValue = "正規化後の履歴入力";
    const bugHistoryStorageKey = "pv:copyHistory:demo:demo-bug-triage";

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: async (_text: string) => {} },
        configurable: true,
      });
    });

    await page.goto("/demo");
    await page.setViewportSize({ width: 1280, height: 720 });

    const input = page.getByTestId(getPlaceholderInputSelector(key));
    const envSelect = page.getByTestId(getPlaceholderInputSelector("env"));
    const errorLogsInput = page.getByTestId(getPlaceholderInputSelector("error_logs"));
    await expect(input).toBeVisible();
    await input.fill(firstValue);
    await envSelect.click();
    await page.getByRole("option", { name: "stg" }).click();

    await page.getByTestId(PV_SELECTORS.copyBodyButton).click();
    await expect(page.getByTestId(PV_SELECTORS.toastSuccess)).toContainText("本文をコピーしました");

    await page.getByTestId(PV_SELECTORS.historyTab).click();
    await expect(page.getByTestId(PV_SELECTORS.historyPanel)).toContainText(firstValue);
    await expect(page.getByTestId(PV_SELECTORS.historyCreatedAt)).toContainText("保存日時:");

    await page.getByTestId(PV_SELECTORS.historyLoadButton).click();
    await expect(page.getByTestId(PV_SELECTORS.toastError)).toContainText(
      "入力欄をクリアしてください",
    );
    await expect(input).toHaveValue(firstValue);

    await page.getByTestId(PV_SELECTORS.clearPlaceholdersButton).click();
    await expect(input).toHaveValue("");
    await expect(envSelect).toContainText("選択してください");
    await page.getByTestId(PV_SELECTORS.historyLoadButton).click();
    await expect(input).toHaveValue(firstValue);
    await expect(page.getByTestId(PV_SELECTORS.previewTab)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText(firstValue);

    await page.reload();
    await expect(page.getByTestId(PV_SELECTORS.historyTab)).toBeVisible();
    await page.getByTestId(PV_SELECTORS.historyTab).click();
    await expect(page.getByTestId(PV_SELECTORS.historyPanel)).toContainText(firstValue);

    await page.evaluate(
      ({ normalizedValue, historyStorageKey }) => {
        const payload = {
          createdAt: new Date().toISOString(),
          title: "BUG切り分けテンプレ（最初の10分）",
          values: {
            goal_text: normalizedValue,
            extra_key: "このキーは現在のテンプレに存在しない",
          },
        };
        window.localStorage.setItem(historyStorageKey, JSON.stringify(payload));
      },
      { normalizedValue, historyStorageKey: bugHistoryStorageKey },
    );

    await page
      .getByTestId(PV_SELECTORS.searchResultItem)
      .filter({ hasText: configPromptTitle })
      .click();
    await expect(page.getByTestId(PV_SELECTORS.previewTab)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page
      .getByTestId(PV_SELECTORS.searchResultItem)
      .filter({ hasText: bugPromptTitle })
      .click();
    await expect(page.getByTestId(PV_SELECTORS.previewTab)).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByTestId(PV_SELECTORS.historyTab).click();
    await expect(page.getByTestId(PV_SELECTORS.historyPanel)).toContainText(normalizedValue);

    await expect(input).toHaveValue("");
    await page.getByTestId(PV_SELECTORS.historyLoadButton).click();
    await expect(input).toHaveValue(normalizedValue);
    await expect(errorLogsInput).toHaveValue("");
    await expect(page.getByTestId(PV_SELECTORS.renderedOutput)).toContainText(normalizedValue);

    await page.getByTestId(PV_SELECTORS.historyTab).click();
    await page.getByTestId(PV_SELECTORS.historyClearButton).click();
    await expect(page.getByTestId(PV_SELECTORS.toastSuccess)).toContainText("履歴をクリアしました");
    await expect(page.getByTestId(PV_SELECTORS.historyPanel)).toContainText(
      "このプロンプトの履歴はまだありません。",
    );
    await expect(input).toHaveValue(normalizedValue);
    await expect(
      page.evaluate((historyStorageKey) => window.localStorage.getItem(historyStorageKey), bugHistoryStorageKey),
    ).resolves.toBeNull();

    await page.reload();
    await page.getByTestId(PV_SELECTORS.historyTab).click();
    await expect(page.getByTestId(PV_SELECTORS.historyPanel)).toContainText(
      "このプロンプトの履歴はまだありません。",
    );
  });

  test("pin したプロンプトが先頭に並び、demo でも pin を切り替えられる", async ({ page }) => {
    const unique = Date.now();
    const titleA = `Pin A ${unique}`;
    const titleB = `Pin B ${unique}`;
    const body = "pin test body";

    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(testUserEmail ?? "");
    await page.getByLabel("パスワード").fill(testUserPassword ?? "");
    await page.getByRole("button", { name: "メールでログイン" }).click();
    await page.waitForURL("**/app/prompts", { timeout: 10_000 });

    await expect(page.getByTestId(PV_SELECTORS.createButton)).toBeVisible({ timeout: 10_000 });

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
    await expect(itemsAfterPinB.nth(0)).toContainText(titleB, { timeout: 10_000 });

    const itemA = page.getByTestId(PV_SELECTORS.searchResultItem).filter({ hasText: titleA });
    await itemA.click();
    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(titleA);
    await itemA.getByTestId(PV_SELECTORS.searchResultPinButton).click();
    await expect(page.getByTestId(PV_SELECTORS.selectedTitle)).toHaveText(titleA);

    const itemsAfterPinA = page.getByTestId(PV_SELECTORS.searchResultItem);
    await expect(itemsAfterPinA).toHaveCount(2, { timeout: 10_000 });
    await expect(itemsAfterPinA.nth(0)).toContainText(titleA, { timeout: 10_000 });
    await expect(itemsAfterPinA.nth(1)).toContainText(titleB, { timeout: 10_000 });

    await page.goto("/demo");

    const demoItems = page.getByTestId(PV_SELECTORS.searchResultItem);
    await expect(demoItems).toHaveCount(6);
    await expect(page.getByTestId(PV_SELECTORS.searchResultPinButton).first()).toBeVisible();

    const demoFirstTitleBefore = await demoItems.nth(0).textContent();
    await demoItems.nth(1).getByTestId(PV_SELECTORS.searchResultPinButton).click();
    await expect(demoItems.nth(0)).not.toContainText(demoFirstTitleBefore ?? "");

    const demoPinnedTitle = await demoItems.nth(0).textContent();
    await demoItems.nth(0).getByTestId(PV_SELECTORS.searchResultPinButton).click();
    await expect(demoItems.nth(0)).not.toContainText(demoPinnedTitle ?? "");

    const demoSixthTitle = await demoItems.nth(5).textContent();
    const demoSecondTitle = await demoItems.nth(1).textContent();
    await demoItems.nth(5).getByTestId(PV_SELECTORS.searchResultPinButton).click();
    await demoItems.nth(2).getByTestId(PV_SELECTORS.searchResultPinButton).click();
    await expect(demoItems.nth(0)).toContainText(demoSecondTitle ?? "");
    await expect(demoItems.nth(1)).toContainText(demoSixthTitle ?? "");

    await page.reload();
    await expect(page.getByTestId(PV_SELECTORS.searchResultPinButton).first()).toBeVisible();
  });
});
