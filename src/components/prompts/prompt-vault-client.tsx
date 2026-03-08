"use client";

import iconSrc from "@/app/icon.png";
import { usePromptVaultPersistence } from "@/components/prompts/hooks/use-prompt-vault-persistence";
import { useResizablePane } from "@/components/prompts/hooks/use-resizable-pane";
import { getPlaceholderFieldSchema } from "@/components/prompts/placeholder-field-schema";
import { PromptPlaceholderField } from "@/components/prompts/prompt-placeholder-field";
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
  applyPinnedStateToPrompts,
  computeNextPinnedIds,
  getCopyHistoryStorageKey,
  getPlaceholderValuesStorageKey,
  isAllPlaceholdersEmpty,
  normalizeValuesByPlaceholders,
  sortPromptsByPinnedAt,
  toAbsoluteDateLabel,
  toRelativeDateLabel,
} from "@/components/prompts/prompt-vault-utils";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorText } from "@/components/ui/error-text";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { PV_SELECTORS, getToastSelector } from "@/constants/ui-selectors";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { parseTagCsv, promptSchema } from "@/schemas/prompt";
import {
  createPromptAction,
  deletePromptAction,
  togglePromptPinAction,
  updatePromptAction,
} from "@/server/actions/prompt-actions";
import { PLACEHOLDER_REGEX, extractPlaceholders, renderTemplate } from "@/utils/placeholder";
import {
  Braces,
  Copy,
  Eraser,
  History,
  Pencil,
  Pin,
  Plus,
  Save,
  Search,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { buttonVariants } from "@/components/ui/button";

const toPromptInputState = (prompt?: PromptLike): PromptInputState => ({
  title: prompt?.title ?? "",
  body: prompt?.body ?? "",
  tagsCsv: prompt?.tags.join(", ") ?? "",
});

const LEFT_PANE_WIDTH_KEY = "pv:leftPaneWidthPx";
const PLACEHOLDER_PANE_WIDTH_KEY = "pv:placeholderPaneWidthPx";
const DEMO_PINNED_PROMPT_IDS_STORAGE_KEY = "pv:demoPinnedPromptIds";
const DEMO_MAX_PINNED_PROMPTS = 6;
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
  const [isPending, startTransition] = useTransition();
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

  const savePrompt = () => {
    if (isDemo) return;
    resetFormErrors();
    const payload = validateForm();
    if (!payload) {
      return;
    }

    startTransition(async () => {
      if (isCreating) {
        const result = await createPromptAction(payload);
        if (result.error) {
          setFormError(result.error.message);
          return;
        }

        setPrompts((prev) => [result.data, ...prev]);
        selectPrompt(result.data);
        return;
      }

      if (!selectedPromptId) {
        setFormError("更新対象が選択されていません");
        return;
      }

      const result = await updatePromptAction(selectedPromptId, payload);
      if (result.error) {
        setFormError(result.error.message);
        return;
      }

      setPrompts((prev) =>
        prev.map((prompt) => (prompt.id === selectedPromptId ? result.data : prompt)),
      );
      setIsEditing(false);
      selectPrompt(result.data);
    });
  };

  const removePrompt = (promptId: string) => {
    if (isDemo) return;
    setFormError("");

    startTransition(async () => {
      const result = await deletePromptAction(promptId);
      if (result.error) {
        setFormError(result.error.message);
        return;
      }

      const nextPrompts = prompts.filter((prompt) => prompt.id !== promptId);
      setPrompts(nextPrompts);

      const nextSelected = nextPrompts[0] ?? null;
      if (nextSelected) {
        selectPrompt(nextSelected);
      } else {
        setSelectedPromptId(null);
        setIsCreating(false);
        setIsEditing(false);
        setFormState(toPromptInputState());
      }
    });
  };

  const logout = () => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    });
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

  const togglePin = (promptId: string) => {
    if (isDemo) {
      setPrompts((prev) => {
        const targetPrompt = prev.find((prompt) => prompt.id === promptId);
        if (!targetPrompt) {
          return prev;
        }

        const currentPinnedIds = prev
          .filter((prompt) => prompt.pinnedAt !== null)
          .sort((left, right) => {
            return (left.pinnedAt?.getTime() ?? 0) - (right.pinnedAt?.getTime() ?? 0);
          })
          .map((prompt) => prompt.id);
        const nextPinnedIds = computeNextPinnedIds(
          currentPinnedIds,
          promptId,
          targetPrompt.pinnedAt !== null,
          DEMO_MAX_PINNED_PROMPTS,
        );
        const nextPrompts = applyPinnedStateToPrompts(prev, nextPinnedIds);

        if (nextPinnedIds.length === 0) {
          localStorage.removeItem(DEMO_PINNED_PROMPT_IDS_STORAGE_KEY);
        } else {
          localStorage.setItem(DEMO_PINNED_PROMPT_IDS_STORAGE_KEY, JSON.stringify(nextPinnedIds));
        }

        return sortPromptsByPinnedAt(nextPrompts, promptOrderMap);
      });
      return;
    }

    setFormError("");

    startTransition(async () => {
      const result = await togglePromptPinAction(promptId);
      if (result.error) {
        setFormError(result.error.message);
        return;
      }

      setPrompts(result.data);
    });
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

  return (
    <div className="h-screen overflow-hidden">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Link href={homeHref} className="flex items-center gap-2 font-semibold">
          <Image
            src={iconSrc}
            alt=""
            width={20}
            height={20}
            className="rounded-sm border-[0.5px] border-white/50"
          />
          <span>Prompt Vault</span>
        </Link>
        {isDemo && (
          <span className="rounded-md border px-2 py-0.5 text-muted-foreground">
            DEMO（閲覧のみ）
          </span>
        )}
        <div className="flex items-center gap-2">
          <div
            data-pv={PV_SELECTORS.versionBanner}
            className={cn(
              "items-center gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-900 shadow-sm dark:text-amber-200",
              hasUpdateAvailable ? "flex" : "hidden",
            )}
          >
            <p>新しいバージョンがあります。</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.reload()}
              data-pv={PV_SELECTORS.versionReloadButton}
            >
              更新する
            </Button>
          </div>
          {isDemo ? (
            <Link href="/login" className={buttonVariants({ variant: "outline" })}>
              ログインして使う
            </Link>
          ) : (
            <Button variant="outline" onClick={logout} disabled={isPending}>
              ログアウト
            </Button>
          )}
        </div>
      </header>

      <div
        className="grid h-[calc(100vh-56px)] min-h-0 overflow-hidden [grid-template-columns:280px_2px_minmax(0,1fr)]"
        style={layoutStyle}
      >
        <aside
          className="flex min-h-0 flex-col overflow-hidden border-r"
          data-pv={PV_SELECTORS.leftPane}
        >
          <div className="space-y-3 p-3">
            {!isDemo && (
              <Button
                className="w-full"
                onClick={switchToCreateMode}
                data-pv={PV_SELECTORS.createButton}
              >
                <Plus className="mr-2 h-4 w-4" />
                新規作成
              </Button>
            )}
            <div className="space-y-1">
              <label htmlFor="prompt-search" className="text-xs font-medium text-muted-foreground">
                検索
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="prompt-search"
                  data-pv={PV_SELECTORS.searchInput}
                  ref={searchInputRef}
                  className="pl-8"
                  placeholder="タイトル / タグで絞り込み"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (filteredPrompts.length === 0) {
                        return;
                      }
                      const selectedInResults = filteredPrompts.find(
                        (prompt) => prompt.id === selectedPromptId,
                      );
                      selectPrompt(selectedInResults ?? filteredPrompts[0]);
                      searchInputRef.current?.blur();
                      return;
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      searchInputRef.current?.blur();
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <ScrollArea className="min-h-0 flex-1 px-3 pb-3">
            <div className="space-y-2">
              {filteredPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  data-pv={PV_SELECTORS.searchResultItem}
                  className={`w-full rounded-md border-l-2 p-2 text-left ${
                    selectedPromptId === prompt.id && !isFormMode
                      ? "border-transparent bg-accent"
                      : prompt.pinnedAt
                        ? "border-primary/40 bg-muted/30 hover:bg-muted"
                        : "border-transparent hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => selectPrompt(prompt)}
                    >
                      <p className="line-clamp-1 text-sm font-medium">{prompt.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {prompt.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag}>{tag}</Badge>
                        ))}
                      </div>
                    </button>
                    <button
                      type="button"
                      data-pv={PV_SELECTORS.searchResultPinButton}
                      className="rounded-sm p-1 text-muted-foreground hover:bg-accent"
                      aria-label={prompt.pinnedAt ? "ピン解除" : "ピン留め"}
                      title={prompt.pinnedAt ? "ピン解除" : "ピン留め"}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        togglePin(prompt.id);
                      }}
                    >
                      <Pin
                        className={`h-4 w-4 ${
                          prompt.pinnedAt ? "text-primary" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <div
          data-pv={PV_SELECTORS.splitterHandle}
          onPointerDown={onSplitterPointerDown}
          className="relative -mx-[3px] h-full w-2 cursor-col-resize justify-self-center before:absolute before:inset-y-0 before:left-1/2 before:w-[2px] before:-translate-x-1/2 before:bg-border/80 hover:before:bg-border"
          style={{ touchAction: "none" }}
        />

        <main className="flex flex-1 flex-col overflow-hidden px-1 pt-2">
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
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, title: event.target.value }))
                  }
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
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, body: event.target.value }))
                  }
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
                  onClick={savePrompt}
                  disabled={isPending}
                  className="gap-2"
                  data-pv={PV_SELECTORS.saveButton}
                >
                  {isPending ? <Spinner /> : <Save className="h-4 w-4" />}
                  <span>保存</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedPrompt) {
                      setIsCreating(false);
                      setIsEditing(false);
                      selectPrompt(selectedPrompt);
                    } else {
                      setIsCreating(false);
                    }
                  }}
                  disabled={isPending}
                >
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
                        onClick={copyPlainText}
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
