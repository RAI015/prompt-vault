"use client";

import { usePromptCrud } from "@/components/prompts/hooks/use-prompt-crud";
import { usePromptVaultPersistence } from "@/components/prompts/hooks/use-prompt-vault-persistence";
import { useResizablePane } from "@/components/prompts/hooks/use-resizable-pane";
import { getPlaceholderFieldSchema } from "@/components/prompts/placeholder-field-schema";
import { PromptDetailPane } from "@/components/prompts/prompt-detail-pane";
import { PromptListPane } from "@/components/prompts/prompt-list-pane";
import { PromptVaultHeader } from "@/components/prompts/prompt-vault-header";
import type {
  CopyHistoryEntry,
  PromptInputState,
  PromptLike,
  PromptVaultMode,
  ToastState,
} from "@/components/prompts/prompt-vault-types";
import {
  SERVICE_OTHER_VALUE,
  SERVICE_PLACEHOLDER_KEY,
  getCopyHistoryStorageKey,
  getPlaceholderValuesStorageKey,
  isAllPlaceholdersEmpty,
  normalizeValuesByPlaceholders,
  toAbsoluteDateLabel,
  toRelativeDateLabel,
} from "@/components/prompts/prompt-vault-utils";
import { PV_SELECTORS, getToastSelector } from "@/constants/ui-selectors";
import { cn } from "@/lib/utils";
import { parseTagCsv, promptSchema } from "@/schemas/prompt";
import { PLACEHOLDER_REGEX, extractPlaceholders, renderTemplate } from "@/utils/placeholder";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const toPromptInputState = (prompt?: PromptLike): PromptInputState => ({
  title: prompt?.title ?? "",
  body: prompt?.body ?? "",
  tagsCsv: prompt?.tags.join(", ") ?? "",
});

const LEFT_PANE_WIDTH_KEY = "pv:leftPaneWidthPx";
const PLACEHOLDER_PANE_WIDTH_KEY = "pv:placeholderPaneWidthPx";
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_LEFT_PANE_WIDTH = 280;
const MIN_LEFT_PANE_WIDTH = 120;
const MAX_LEFT_PANE_WIDTH = 520;
const DEFAULT_PLACEHOLDER_PANE_WIDTH = 360;
const MIN_PLACEHOLDER_PANE_WIDTH = 280;
const MAX_PLACEHOLDER_PANE_WIDTH = 560;

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable || target.closest("[contenteditable='true']")) {
    return true;
  }
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
};

export const PromptVaultClient = ({
  initialPrompts,
  mode = "app",
  initialFrontendVersion,
}: {
  initialPrompts: PromptLike[];
  mode?: PromptVaultMode;
  initialFrontendVersion: string;
}) => {
  const isDemo = mode === "demo";
  const homeHref = isDemo ? "/demo" : "/app/prompts";
  const placeholderValuesStorageKey = getPlaceholderValuesStorageKey(mode);

  const [prompts, setPrompts] = useState<PromptLike[]>(initialPrompts);
  const [search, setSearch] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(
    initialPrompts[0]?.id ?? null,
  );

  const [isCreating, setIsCreating] = useState(isDemo ? false : initialPrompts.length === 0);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<PromptInputState>(() =>
    toPromptInputState(initialPrompts[0]),
  );
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; body?: string; tags?: string }>(
    {},
  );
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [placeholderUndoValues, setPlaceholderUndoValues] = useState<Record<string, string>>({});
  const [serviceInputMode, setServiceInputMode] = useState<"preset" | "custom">("preset");
  const [activePlaceholderKey, setActivePlaceholderKey] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<"preview" | "history">("preview");
  const [copyHistory, setCopyHistory] = useState<CopyHistoryEntry | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const previousSelectedPromptIdRef = useRef<string | null>(selectedPromptId);
  const promptOrderMap = useMemo(
    () => new Map(initialPrompts.map((prompt, index) => [prompt.id, index])),
    [initialPrompts],
  );
  const { width: leftPaneWidth, onPointerDown: onSplitterPointerDown } = useResizablePane({
    storageKey: LEFT_PANE_WIDTH_KEY,
    defaultWidth: DEFAULT_LEFT_PANE_WIDTH,
    minWidth: MIN_LEFT_PANE_WIDTH,
    maxWidth: MAX_LEFT_PANE_WIDTH,
  });
  const { width: placeholderPaneWidth, onPointerDown: onPreviewSplitterPointerDown } =
    useResizablePane({
      storageKey: PLACEHOLDER_PANE_WIDTH_KEY,
      defaultWidth: DEFAULT_PLACEHOLDER_PANE_WIDTH,
      minWidth: MIN_PLACEHOLDER_PANE_WIDTH,
      maxWidth: MAX_PLACEHOLDER_PANE_WIDTH,
    });

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (hasUpdateAvailable) {
      return;
    }

    let isDisposed = false;

    const checkFrontendVersion = async () => {
      try {
        const response = await fetch(`/api/version?ts=${Date.now()}`, {
          cache: "no-store",
          headers: {
            pragma: "no-cache",
          },
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { version?: unknown };
        if (isDisposed || typeof payload.version !== "string") {
          return;
        }
        if (payload.version !== initialFrontendVersion) {
          setHasUpdateAvailable(true);
        }
      } catch {
        // 更新確認はベストエフォートとし、失敗時は通知を出さない。
      }
    };

    const intervalId = window.setInterval(checkFrontendVersion, VERSION_CHECK_INTERVAL_MS);
    const onWindowFocus = () => {
      void checkFrontendVersion();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkFrontendVersion();
      }
    };

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [hasUpdateAvailable, initialFrontendVersion]);

  const serviceValue = placeholderValues[SERVICE_PLACEHOLDER_KEY];

  useEffect(() => {
    if (serviceValue === undefined) {
      setServiceInputMode("preset");
      return;
    }

    const serviceSchema = getPlaceholderFieldSchema(SERVICE_PLACEHOLDER_KEY);
    if (serviceSchema?.type !== "select") {
      setServiceInputMode("preset");
      return;
    }

    const normalizedServiceValue = serviceValue.trim();
    const presetOptions = serviceSchema.options.filter((option) => option !== SERVICE_OTHER_VALUE);
    if (normalizedServiceValue.length > 0 && presetOptions.includes(normalizedServiceValue)) {
      setServiceInputMode("preset");
      return;
    }

    setServiceInputMode("custom");
  }, [serviceValue]);

  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === selectedPromptId) ?? null,
    [prompts, selectedPromptId],
  );

  const layoutStyle = useMemo(() => {
    if (!isHydrated) {
      return undefined;
    }

    return {
      display: "grid",
      gridTemplateColumns: `${leftPaneWidth}px 2px 1fr`,
    } as CSSProperties;
  }, [isHydrated, leftPaneWidth]);

  const previewPaneLayoutStyle = useMemo(() => {
    if (!isHydrated) {
      return undefined;
    }

    return {
      "--pv-placeholder-pane-width": `${placeholderPaneWidth}px`,
    } as CSSProperties;
  }, [isHydrated, placeholderPaneWidth]);

  const filteredPrompts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return prompts;
    }

    return prompts.filter((prompt) => {
      const titleMatched = prompt.title.toLowerCase().includes(query);
      const tagMatched = prompt.tags.some((tag) => tag.toLowerCase().includes(query));
      return titleMatched || tagMatched;
    });
  }, [prompts, search]);

  const previewBody = selectedPrompt?.body ?? formState.body;
  const placeholders = useMemo(() => extractPlaceholders(previewBody), [previewBody]);
  const normalizedHistoryValues = useMemo(() => {
    return normalizeValuesByPlaceholders(placeholders, copyHistory?.values ?? {});
  }, [copyHistory?.values, placeholders]);
  const renderedHistoryBody = useMemo(() => {
    if (!copyHistory) {
      return "";
    }
    return renderTemplate(previewBody, normalizedHistoryValues);
  }, [copyHistory, normalizedHistoryValues, previewBody]);
  const renderedBody = renderTemplate(previewBody, placeholderValues);
  const renderedPreviewNodes = useMemo(() => {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of previewBody.matchAll(PLACEHOLDER_REGEX)) {
      const [token, key] = match;
      const index = match.index ?? 0;

      if (index > lastIndex) {
        nodes.push(previewBody.slice(lastIndex, index));
      }

      const value = placeholderValues[key] ?? "";
      if (value === "") {
        nodes.push(
          <span
            key={`${key}-${index}`}
            className={cn(
              "text-muted-foreground/50",
              activePlaceholderKey === key
                ? "rounded-sm bg-emerald-500/15 ring-1 ring-emerald-500/55"
                : null,
            )}
          >
            {token}
          </span>,
        );
      } else {
        nodes.push(value);
      }

      lastIndex = index + token.length;
    }

    if (lastIndex < previewBody.length) {
      nodes.push(previewBody.slice(lastIndex));
    }

    return nodes;
  }, [activePlaceholderKey, placeholderValues, previewBody]);

  const { isSelectedPromptIdRestored } = usePromptVaultPersistence({
    mode,
    isDemo,
    initialPrompts,
    promptOrderMap,
    prompts,
    selectedPromptId,
    setSelectedPromptId,
    placeholderValues,
    setPlaceholderValues,
    placeholders,
    setCopyHistory,
    setPrompts,
  });

  useEffect(() => {
    if (previousSelectedPromptIdRef.current === selectedPromptId) {
      return;
    }
    previousSelectedPromptIdRef.current = selectedPromptId;
    setActiveRightTab("preview");
  }, [selectedPromptId]);

  const resetFormErrors = () => {
    setFormError("");
    setFieldErrors({});
  };

  const switchToCreateMode = () => {
    if (isDemo) return;
    setIsCreating(true);
    setIsEditing(false);
    setSelectedPromptId(null);
    setServiceInputMode("preset");
    setActivePlaceholderKey(null);
    setFormState(toPromptInputState());
    setPlaceholderValues({});
    setPlaceholderUndoValues({});
    setToast(null);
    resetFormErrors();
  };

  const selectPrompt = (prompt: PromptLike) => {
    setSelectedPromptId(prompt.id);
    setIsCreating(false);
    setIsEditing(false);
    setServiceInputMode("preset");
    setActivePlaceholderKey(null);
    setFormState(toPromptInputState(prompt));
    setPlaceholderValues({});
    setPlaceholderUndoValues({});
    setToast(null);
    resetFormErrors();
  };

  const onPromptsEmpty = useCallback(() => {
    setSelectedPromptId(null);
    setIsCreating(false);
    setIsEditing(false);
    setFormState(toPromptInputState());
  }, []);

  const { isPending, savePrompt, removePrompt, togglePin, logout } = usePromptCrud({
    isDemo,
    prompts,
    promptOrderMap,
    setPrompts,
    setFormError,
    setIsEditing,
    selectPrompt,
    onPromptsEmpty,
  });

  const validateForm = (): { title: string; body: string; tags: string[] } | null => {
    const payload = {
      title: formState.title,
      body: formState.body,
      tags: parseTagCsv(formState.tagsCsv),
    };

    const parsed = promptSchema.safeParse(payload);
    if (parsed.success) {
      return parsed.data;
    }

    const nextErrors: { title?: string; body?: string; tags?: string } = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "title") {
        nextErrors.title = issue.message;
      }
      if (issue.path[0] === "body") {
        nextErrors.body = issue.message;
      }
      if (issue.path[0] === "tags") {
        nextErrors.tags = issue.message;
      }
    }

    setFieldErrors(nextErrors);
    return null;
  };

  const onSavePrompt = () => {
    if (isDemo) return;
    resetFormErrors();
    const payload = validateForm();
    if (!payload) {
      return;
    }
    savePrompt({ payload, isCreating, selectedPromptId });
  };

  const startEdit = () => {
    if (isDemo) return;
    if (!selectedPrompt) {
      return;
    }

    setIsEditing(true);
    setIsCreating(false);
    setFormState(toPromptInputState(selectedPrompt));
    resetFormErrors();
  };

  const showToast = useCallback((message: string, variant: ToastState["variant"]) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, variant });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const copyPlainText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(renderedBody);
      showToast("本文をコピーしました", "success");

      if (!selectedPrompt) {
        return;
      }

      const nextHistory: CopyHistoryEntry = {
        createdAt: new Date().toISOString(),
        title: selectedPrompt.title,
        values: { ...placeholderValues },
      };
      setCopyHistory(nextHistory);

      try {
        localStorage.setItem(
          getCopyHistoryStorageKey(mode, selectedPrompt.id),
          JSON.stringify(nextHistory),
        );
      } catch {
        showToast("履歴の保存に失敗しました", "error");
      }
    } catch {
      showToast("本文コピーに失敗しました", "error");
    }
  }, [mode, placeholderValues, renderedBody, selectedPrompt, showToast]);

  const copyMarkdownText = useCallback(async () => {
    const markdownText = `\`\`\`\n${renderedBody}\n\`\`\``;
    try {
      await navigator.clipboard.writeText(markdownText);
      showToast("Markdown整形コピーしました", "success");
    } catch {
      showToast("Markdown整形コピーに失敗しました", "error");
    }
  }, [renderedBody, showToast]);

  const copyOriginalText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(selectedPrompt?.body ?? "");
      showToast("原文をコピーしました", "success");
    } catch {
      showToast("原文コピーに失敗しました", "error");
    }
  }, [selectedPrompt, showToast]);

  const clearPlaceholderValues = useCallback(() => {
    setPlaceholderValues({});
    setPlaceholderUndoValues({});
    setServiceInputMode("preset");
    localStorage.removeItem(placeholderValuesStorageKey);
  }, [placeholderValuesStorageKey]);

  const loadCopyHistory = useCallback(() => {
    if (!copyHistory) {
      return;
    }
    if (!isAllPlaceholdersEmpty(placeholders, placeholderValues)) {
      showToast("入力欄をクリアしてください", "error");
      return;
    }

    setPlaceholderValues(normalizedHistoryValues);
    setActiveRightTab("preview");
  }, [copyHistory, normalizedHistoryValues, placeholderValues, placeholders, showToast]);

  const clearCopyHistory = useCallback(() => {
    if (!selectedPromptId) {
      return;
    }

    try {
      localStorage.removeItem(getCopyHistoryStorageKey(mode, selectedPromptId));
      setCopyHistory(null);
      showToast("履歴をクリアしました", "success");
    } catch {
      showToast("履歴の削除に失敗しました", "error");
    }
  }, [mode, selectedPromptId, showToast]);

  const fillPlaceholderExamples = useCallback(() => {
    setPlaceholderValues((prev) => {
      const next = { ...prev };
      let hasChanges = false;

      for (const key of placeholders) {
        const currentValue = prev[key] ?? "";
        if (currentValue.trim().length > 0) {
          continue;
        }

        const example = getPlaceholderFieldSchema(key)?.example;
        if (!example) {
          continue;
        }

        next[key] = example;
        hasChanges = true;
      }

      return hasChanges ? next : prev;
    });
  }, [placeholders]);

  const applyErrorLogsTransform = useCallback(
    (key: string, transform: (value: string) => string) => {
      const current = placeholderValues[key] ?? "";
      const next = transform(current);
      if (next === current) {
        return;
      }
      setPlaceholderValues((prev) => ({ ...prev, [key]: next }));
      setPlaceholderUndoValues((prev) => {
        if (prev[key] !== undefined) {
          return prev;
        }
        return { ...prev, [key]: current };
      });
    },
    [placeholderValues],
  );

  const restoreErrorLogsValue = useCallback(
    (key: string) => {
      const undoValue = placeholderUndoValues[key];
      if (undoValue === undefined) {
        return;
      }
      setPlaceholderValues((prev) => ({ ...prev, [key]: undoValue }));
      setPlaceholderUndoValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [placeholderUndoValues],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (event.code === "KeyC" && event.altKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        void copyPlainText();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [copyPlainText]);

  const isFormMode = isCreating || isEditing;
  const canClearPlaceholders = placeholders.some(
    (key) => (placeholderValues[key] ?? "").length > 0,
  );
  const canFillPlaceholderExamples = placeholders.some((key) => {
    const example = getPlaceholderFieldSchema(key)?.example;
    if (!example) {
      return false;
    }

    return (placeholderValues[key] ?? "").trim().length === 0;
  });

  const onCancelForm = () => {
    if (selectedPrompt) {
      setIsCreating(false);
      setIsEditing(false);
      selectPrompt(selectedPrompt);
      return;
    }
    setIsCreating(false);
  };

  return (
    <div className="h-screen overflow-hidden">
      <PromptVaultHeader
        homeHref={homeHref}
        isDemo={isDemo}
        hasUpdateAvailable={hasUpdateAvailable}
        logout={logout}
        isPending={isPending}
      />

      <div
        className="grid h-[calc(100vh-56px)] min-h-0 overflow-hidden [grid-template-columns:280px_2px_minmax(0,1fr)]"
        style={layoutStyle}
      >
        <PromptListPane
          isDemo={isDemo}
          search={search}
          setSearch={setSearch}
          searchInputRef={searchInputRef}
          switchToCreateMode={switchToCreateMode}
          filteredPrompts={filteredPrompts}
          selectedPromptId={selectedPromptId}
          isFormMode={isFormMode}
          selectPrompt={selectPrompt}
          togglePin={togglePin}
        />

        <div
          data-pv={PV_SELECTORS.splitterHandle}
          onPointerDown={onSplitterPointerDown}
          className="relative -mx-[3px] h-full w-2 cursor-col-resize justify-self-center before:absolute before:inset-y-0 before:left-1/2 before:w-[2px] before:-translate-x-1/2 before:bg-border/80 hover:before:bg-border"
          style={{ touchAction: "none" }}
        />

        <main className="flex flex-1 flex-col overflow-hidden px-1 pt-2">
          <PromptDetailPane
            isFormMode={isFormMode}
            selectedPrompt={selectedPrompt}
            isCreating={isCreating}
            formError={formError}
            fieldErrors={fieldErrors}
            formState={formState}
            setFormState={setFormState}
            onSavePrompt={onSavePrompt}
            isPending={isPending}
            onCancelForm={onCancelForm}
            isDemo={isDemo}
            startEdit={startEdit}
            removePrompt={removePrompt}
            previewPaneLayoutStyle={previewPaneLayoutStyle}
            placeholders={placeholders}
            clearPlaceholderValues={clearPlaceholderValues}
            canClearPlaceholders={canClearPlaceholders}
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
            onPreviewSplitterPointerDown={onPreviewSplitterPointerDown}
            activeRightTab={activeRightTab}
            setActiveRightTab={setActiveRightTab}
            copyPlainText={copyPlainText}
            copyMarkdownText={copyMarkdownText}
            copyOriginalText={copyOriginalText}
            renderedPreviewNodes={renderedPreviewNodes}
            copyHistory={copyHistory}
            toAbsoluteDateLabel={toAbsoluteDateLabel}
            toRelativeDateLabel={toRelativeDateLabel}
            loadCopyHistory={loadCopyHistory}
            clearCopyHistory={clearCopyHistory}
            renderedHistoryBody={renderedHistoryBody}
          />
        </main>
      </div>
      {toast ? (
        <div
          data-pv={getToastSelector(toast.variant)}
          className={`fixed bottom-4 right-4 z-50 rounded-md border px-3 py-2 text-sm shadow-md ${
            toast.variant === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
};
