import { PromptPlaceholderField } from "@/components/prompts/prompt-placeholder-field";
import type {
  CopyHistoryEntry,
  PromptInputState,
  PromptLike,
} from "@/components/prompts/prompt-vault-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorText } from "@/components/ui/error-text";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { PV_SELECTORS } from "@/constants/ui-selectors";
import { cn } from "@/lib/utils";
import { Braces, Copy, Eraser, History, Pencil, Save, Trash2 } from "lucide-react";
import type {
  CSSProperties,
  Dispatch,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react";

type PromptDetailPaneProps = {
  isFormMode: boolean;
  selectedPrompt: PromptLike | null;
  isCreating: boolean;
  formError: string;
  fieldErrors: { title?: string; body?: string; tags?: string };
  formState: PromptInputState;
  setFormState: Dispatch<SetStateAction<PromptInputState>>;
  onSavePrompt: () => void;
  isPending: boolean;
  onCancelForm: () => void;
  isDemo: boolean;
  startEdit: () => void;
  removePrompt: (promptId: string) => void;
  previewPaneLayoutStyle: CSSProperties | undefined;
  placeholders: string[];
  clearPlaceholderValues: () => void;
  canClearPlaceholders: boolean;
  placeholderValues: Record<string, string>;
  placeholderUndoValues: Record<string, string>;
  serviceInputMode: "preset" | "custom";
  canFillPlaceholderExamples: boolean;
  setActivePlaceholderKey: (key: string | null) => void;
  setPlaceholderValues: Dispatch<SetStateAction<Record<string, string>>>;
  setServiceInputMode: Dispatch<SetStateAction<"preset" | "custom">>;
  fillPlaceholderExamples: () => void;
  applyErrorLogsTransform: (key: string, transform: (value: string) => string) => void;
  restoreErrorLogsValue: (key: string) => void;
  onPreviewSplitterPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  activeRightTab: "preview" | "history";
  setActiveRightTab: (tab: "preview" | "history") => void;
  copyPlainText: () => Promise<void>;
  copyMarkdownText: () => Promise<void>;
  copyOriginalText: () => Promise<void>;
  renderedPreviewNodes: ReactNode[];
  copyHistory: CopyHistoryEntry | null;
  toAbsoluteDateLabel: (isoDate: string) => string;
  toRelativeDateLabel: (isoDate: string) => string;
  loadCopyHistory: () => void;
  clearCopyHistory: () => void;
  renderedHistoryBody: string;
};

export const PromptDetailPane = ({
  isFormMode,
  selectedPrompt,
  isCreating,
  formError,
  fieldErrors,
  formState,
  setFormState,
  onSavePrompt,
  isPending,
  onCancelForm,
  isDemo,
  startEdit,
  removePrompt,
  previewPaneLayoutStyle,
  placeholders,
  clearPlaceholderValues,
  canClearPlaceholders,
  placeholderValues,
  placeholderUndoValues,
  serviceInputMode,
  canFillPlaceholderExamples,
  setActivePlaceholderKey,
  setPlaceholderValues,
  setServiceInputMode,
  fillPlaceholderExamples,
  applyErrorLogsTransform,
  restoreErrorLogsValue,
  onPreviewSplitterPointerDown,
  activeRightTab,
  setActiveRightTab,
  copyPlainText,
  copyMarkdownText,
  copyOriginalText,
  renderedPreviewNodes,
  copyHistory,
  toAbsoluteDateLabel,
  toRelativeDateLabel,
  loadCopyHistory,
  clearCopyHistory,
  renderedHistoryBody,
}: PromptDetailPaneProps) => {
  return (
    <>
      {!isFormMode && !selectedPrompt ? (
        <div className="flex h-full items-center justify-center px-6 text-muted-foreground">
          プロンプトを選択してください
        </div>
      ) : null}

      {isFormMode ? (
        <div className="mx-auto min-h-0 w-full max-w-4xl overflow-y-auto space-y-4">
          <h2 className="text-xl font-bold">
            {isCreating ? "新規プロンプト作成" : "プロンプト編集"}
          </h2>

          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="space-y-1">
            <label htmlFor="title" className="text-sm font-medium">
              タイトル
            </label>
            <Input
              id="title"
              data-pv={PV_SELECTORS.titleInput}
              value={formState.title}
              onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
            />
            <ErrorText>{fieldErrors.title}</ErrorText>
          </div>

          <div className="space-y-1">
            <label htmlFor="body" className="text-sm font-medium">
              本文
            </label>
            <Textarea
              id="body"
              data-pv={PV_SELECTORS.bodyInput}
              rows={14}
              value={formState.body}
              onChange={(event) => setFormState((prev) => ({ ...prev, body: event.target.value }))}
            />
            <ErrorText>{fieldErrors.body}</ErrorText>
          </div>

          <div className="space-y-1">
            <label htmlFor="tags" className="text-sm font-medium">
              タグ（カンマ区切り）
            </label>
            <Input
              id="tags"
              data-pv={PV_SELECTORS.tagsInput}
              placeholder="例: design, prompt, gpt"
              value={formState.tagsCsv}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, tagsCsv: event.target.value }))
              }
            />
            <ErrorText>{fieldErrors.tags}</ErrorText>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={onSavePrompt}
              disabled={isPending}
              className="gap-2"
              data-pv={PV_SELECTORS.saveButton}
            >
              {isPending ? <Spinner /> : <Save className="h-4 w-4" />}
              <span>保存</span>
            </Button>
            <Button variant="outline" onClick={onCancelForm} disabled={isPending}>
              キャンセル
            </Button>
          </div>
        </div>
      ) : null}

      {!isFormMode && selectedPrompt ? (
        <div className="flex min-h-0 flex-1 flex-col">
          {formError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <div className="-ml-3 space-y-2 border-b bg-background pb-3 pl-6 pr-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold" data-pv={PV_SELECTORS.selectedTitle}>
                {selectedPrompt.title}
              </h2>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {selectedPrompt.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
              {!isDemo ? (
                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    <Pencil className="mr-2 h-4 w-4" />
                    編集
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" />
                        削除
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>プロンプトを削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          削除したプロンプトは復元できません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel asChild>
                          <Button variant="outline">キャンセル</Button>
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                          <Button
                            variant="destructive"
                            onClick={() => removePrompt(selectedPrompt.id)}
                            disabled={isPending}
                          >
                            削除する
                          </Button>
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="grid min-h-0 flex-1 gap-0 pt-2 xl:grid-cols-[var(--pv-placeholder-pane-width,360px)_2px_minmax(0,1fr)]"
            style={previewPaneLayoutStyle}
          >
            <section
              data-pv={PV_SELECTORS.placeholderPane}
              className="flex min-h-0 flex-col overflow-hidden rounded-l-md rounded-r-none border bg-muted/20 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Braces className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">プレースホルダ入力</h3>
                  <Badge variant="secondary">{placeholders.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearPlaceholderValues}
                    disabled={!canClearPlaceholders}
                    title="入力をすべて空にします"
                    data-pv={PV_SELECTORS.clearPlaceholdersButton}
                  >
                    <Eraser className="mr-2 h-4 w-4" />
                    全消去
                  </Button>
                </div>
              </div>
              {placeholders.length > 0 ? (
                <>
                  <p className="mt-3 text-xs text-muted-foreground">
                    「{"{{...}}"}」ごとの値を入力すると、右のプレビューに反映されます。
                  </p>
                  <ScrollArea className="mt-3 min-h-0 flex-1 pr-3">
                    <div className="space-y-3">
                      {placeholders.map((key) => (
                        <PromptPlaceholderField
                          key={key}
                          placeholderKey={key}
                          placeholderValues={placeholderValues}
                          placeholderUndoValues={placeholderUndoValues}
                          serviceInputMode={serviceInputMode}
                          canFillPlaceholderExamples={canFillPlaceholderExamples}
                          setActivePlaceholderKey={setActivePlaceholderKey}
                          setPlaceholderValues={setPlaceholderValues}
                          setServiceInputMode={setServiceInputMode}
                          fillPlaceholderExamples={fillPlaceholderExamples}
                          applyErrorLogsTransform={applyErrorLogsTransform}
                          restoreErrorLogsValue={restoreErrorLogsValue}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="mt-3 rounded-md border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
                  このプロンプトにはプレースホルダがありません。
                </div>
              )}
            </section>

            <div
              data-pv={PV_SELECTORS.previewSplitterHandle}
              onPointerDown={onPreviewSplitterPointerDown}
              className="relative hidden -mx-[3px] h-full w-2 cursor-col-resize justify-self-center before:absolute before:inset-y-0 before:left-1/2 before:w-[2px] before:-translate-x-1/2 before:bg-border/80 hover:before:bg-border xl:block"
              style={{ touchAction: "none" }}
              aria-hidden="true"
            />

            <section
              data-pv={PV_SELECTORS.previewPane}
              className="flex min-h-0 flex-col overflow-hidden rounded-l-none rounded-r-md border border-l-0 bg-muted/20 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <div
                  className="inline-flex rounded-md border bg-background/60 p-1"
                  role="tablist"
                  aria-label="プレビューと履歴"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeRightTab === "preview"}
                    aria-controls="preview-rendered-panel"
                    className={cn(
                      "w-24 rounded px-3 py-1 text-center text-sm",
                      activeRightTab === "preview"
                        ? "bg-accent font-medium"
                        : "text-muted-foreground",
                    )}
                    onClick={() => setActiveRightTab("preview")}
                    data-pv={PV_SELECTORS.previewTab}
                  >
                    プレビュー
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeRightTab === "history"}
                    aria-controls="history-panel"
                    className={cn(
                      "w-24 rounded px-3 py-1 text-center text-sm",
                      activeRightTab === "history"
                        ? "bg-accent font-medium"
                        : "text-muted-foreground",
                    )}
                    onClick={() => setActiveRightTab("history")}
                    data-pv={PV_SELECTORS.historyTab}
                  >
                    履歴
                  </button>
                </div>
              </div>

              <div
                id="preview-rendered-panel"
                className={cn(
                  "mt-3 min-h-0 flex-1 flex-col gap-2",
                  activeRightTab === "preview" ? "flex" : "hidden",
                )}
              >
                <div className="flex h-9 items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void copyPlainText();
                    }}
                    title="プロンプト本文のみをコピーします"
                    data-pv={PV_SELECTORS.copyBodyButton}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    本文コピー
                    <kbd className="ml-2 rounded border px-1 text-[10px] leading-4 text-muted-foreground">
                      ⌥C
                    </kbd>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                      data-pv={PV_SELECTORS.copyMenuButton}
                    >
                      …
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => {
                          void copyMarkdownText();
                        }}
                        data-pv={PV_SELECTORS.copyMarkdownButton}
                      >
                        Markdown整形コピー
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          void copyOriginalText();
                        }}
                        data-pv={PV_SELECTORS.copyOriginalButton}
                      >
                        原文（テンプレ）コピー
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <ScrollArea
                  data-pv={PV_SELECTORS.renderedOutput}
                  className="min-h-0 flex-1 whitespace-pre-wrap rounded-md bg-background/60 p-4"
                >
                  {renderedPreviewNodes}
                </ScrollArea>
              </div>

              <div
                id="history-panel"
                data-pv={PV_SELECTORS.historyPanel}
                className={cn(
                  "mt-3 min-h-0 flex-1 flex-col gap-2",
                  activeRightTab === "history" ? "flex" : "hidden",
                )}
              >
                {copyHistory ? (
                  <>
                    <div className="flex h-9 items-center justify-between gap-2">
                      <p
                        className="text-xs text-muted-foreground"
                        title={toAbsoluteDateLabel(copyHistory.createdAt)}
                        data-pv={PV_SELECTORS.historyCreatedAt}
                      >
                        保存日時: {toRelativeDateLabel(copyHistory.createdAt)}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={loadCopyHistory}
                          data-pv={PV_SELECTORS.historyLoadButton}
                          disabled={!copyHistory}
                        >
                          <History className="mr-2 h-4 w-4" />
                          ロード
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearCopyHistory}
                          data-pv={PV_SELECTORS.historyClearButton}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          履歴クリア
                        </Button>
                      </div>
                    </div>
                    <ScrollArea
                      data-pv={PV_SELECTORS.historyRenderedOutput}
                      className="min-h-0 flex-1 whitespace-pre-wrap rounded-md bg-background/60 p-4"
                    >
                      {renderedHistoryBody}
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground">
                      ※現在のテンプレに当てたプレビューです
                    </p>
                  </>
                ) : (
                  <div className="rounded-md border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
                    このプロンプトの履歴はまだありません。
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
};
