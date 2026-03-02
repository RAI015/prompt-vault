"use client";

import iconSrc from "@/app/icon.png";
import { getPlaceholderFieldSchema } from "@/components/prompts/placeholder-field-schema";
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
import { ErrorText } from "@/components/ui/error-text";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  PV_SELECTORS,
  getPlaceholderInputSelector,
  getPlaceholderLogActionSelector,
  getPlaceholderLogLineCountSelector,
  getToastSelector,
} from "@/constants/ui-selectors";
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
import type { Prompt } from "@prisma/client";
import { Braces, Copy, Eraser, Pencil, Pin, Plus, Save, Search, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { buttonVariants } from "@/components/ui/button";

type PromptInputState = {
  title: string;
  body: string;
  tagsCsv: string;
};

const toPromptInputState = (prompt?: PromptLike): PromptInputState => ({
  title: prompt?.title ?? "",
  body: prompt?.body ?? "",
  tagsCsv: prompt?.tags.join(", ") ?? "",
});

const LONGTEXT_SUFFIXES = ["logs", "text", "details", "content", "body", "notes"] as const;
const LONGTEXT_RE = new RegExp(`(^|_)(${LONGTEXT_SUFFIXES.join("|")})($|_)`, "i");

const isLongTextPlaceholder = (key: string): boolean => LONGTEXT_RE.test(key);

const isLogsPlaceholder = (key: string): boolean => {
  return key.toLowerCase().endsWith("_logs");
};

const LOG_TRIM_LINE_COUNT = 50;
const LEFT_PANE_WIDTH_KEY = "pv:leftPaneWidthPx";
const PLACEHOLDER_VALUES_STORAGE_KEY_PREFIX = "pv:placeholders:";
const DEFAULT_LEFT_PANE_WIDTH = 280;
const MIN_LEFT_PANE_WIDTH = 120;
const MAX_LEFT_PANE_WIDTH = 520;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const splitLines = (value: string): string[] => {
  if (!value) {
    return [];
  }
  return value.split(/\r?\n/);
};

const toHeadLines = (value: string, lineCount: number): string => {
  return splitLines(value).slice(0, lineCount).join("\n");
};

const toTailLines = (value: string, lineCount: number): string => {
  const lines = splitLines(value);
  return lines.slice(Math.max(0, lines.length - lineCount)).join("\n");
};

const toHeadTailLines = (value: string, lineCount: number): string => {
  const lines = splitLines(value);
  if (lines.length <= lineCount * 2) {
    return value;
  }
  const omitted = lines.length - lineCount * 2;
  const head = lines.slice(0, lineCount);
  const tail = lines.slice(lines.length - lineCount);
  return [...head, `... (${omitted} lines omitted) ...`, ...tail].join("\n");
};

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

type ToastState = {
  message: string;
  variant: "success" | "error";
};

type PromptLike = Pick<Prompt, "id" | "title" | "tags" | "body" | "pinnedAt">;
type PromptVaultMode = "app" | "demo";
type PreviewTab = "rendered" | "original";

export const PromptVaultClient = ({
  initialPrompts,
  mode = "app",
}: {
  initialPrompts: PromptLike[];
  mode?: PromptVaultMode;
}) => {
  const isDemo = mode === "demo";
  const homeHref = isDemo ? "/demo" : "/app/prompts";
  const placeholderValuesStorageKey = `${PLACEHOLDER_VALUES_STORAGE_KEY_PREFIX}${mode}`;

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
  const [activePlaceholderKey, setActivePlaceholderKey] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<PreviewTab>("rendered");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(DEFAULT_LEFT_PANE_WIDTH);
  const leftPaneWidthRef = useRef<number>(DEFAULT_LEFT_PANE_WIDTH);
  const dragStateRef = useRef<{
    isDragging: boolean;
    pointerId: number | null;
    startX: number;
    startWidth: number;
  }>({
    isDragging: false,
    pointerId: null,
    startX: 0,
    startWidth: DEFAULT_LEFT_PANE_WIDTH,
  });
  const [isPending, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(LEFT_PANE_WIDTH_KEY);
    if (!raw) return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      const width = clamp(parsed, MIN_LEFT_PANE_WIDTH, MAX_LEFT_PANE_WIDTH);
      leftPaneWidthRef.current = width;
      setLeftPaneWidth(width);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(placeholderValuesStorageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        localStorage.removeItem(placeholderValuesStorageKey);
        return;
      }

      const nextValues = Object.fromEntries(
        Object.entries(parsed).filter(
          (entry): entry is [string, string] =>
            typeof entry[0] === "string" && typeof entry[1] === "string",
        ),
      );
      setPlaceholderValues(nextValues);
    } catch {
      localStorage.removeItem(placeholderValuesStorageKey);
    }
  }, [placeholderValuesStorageKey]);

  useEffect(() => {
    if (Object.keys(placeholderValues).length === 0) {
      localStorage.removeItem(placeholderValuesStorageKey);
      return;
    }

    localStorage.setItem(placeholderValuesStorageKey, JSON.stringify(placeholderValues));
  }, [placeholderValues, placeholderValuesStorageKey]);

  useEffect(() => {
    leftPaneWidthRef.current = leftPaneWidth;
  }, [leftPaneWidth]);

  const finishDragging = useCallback(
    (finalWidth?: number) => {
      if (!dragStateRef.current.isDragging) return;
      dragStateRef.current.isDragging = false;
      dragStateRef.current.pointerId = null;

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      const widthToSave = clamp(
        finalWidth ?? leftPaneWidthRef.current,
        MIN_LEFT_PANE_WIDTH,
        MAX_LEFT_PANE_WIDTH,
      );
      leftPaneWidthRef.current = widthToSave;
      setLeftPaneWidth(widthToSave);
      localStorage.setItem(LEFT_PANE_WIDTH_KEY, String(widthToSave));
    },
    // File-scope constants are intentionally excluded from deps.
    [],
  );

  const onSplitterPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragStateRef.current = {
      isDragging: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: leftPaneWidthRef.current,
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current.isDragging) return;
      if (dragStateRef.current.pointerId !== event.pointerId) return;
      const delta = event.clientX - dragStateRef.current.startX;
      const next = clamp(
        dragStateRef.current.startWidth + delta,
        MIN_LEFT_PANE_WIDTH,
        MAX_LEFT_PANE_WIDTH,
      );
      leftPaneWidthRef.current = next;
      setLeftPaneWidth(next);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!dragStateRef.current.isDragging) return;
      if (dragStateRef.current.pointerId !== event.pointerId) return;
      const delta = event.clientX - dragStateRef.current.startX;
      const finalWidth = clamp(
        dragStateRef.current.startWidth + delta,
        MIN_LEFT_PANE_WIDTH,
        MAX_LEFT_PANE_WIDTH,
      );
      finishDragging(finalWidth);
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (dragStateRef.current.pointerId !== event.pointerId) return;
      finishDragging();
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      dragStateRef.current.isDragging = false;
      dragStateRef.current.pointerId = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [finishDragging]);

  const selectedPrompt = useMemo(
    () => prompts.find((prompt) => prompt.id === selectedPromptId) ?? null,
    [prompts, selectedPromptId],
  );

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
  const placeholders = extractPlaceholders(previewBody);
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

  const resetFormErrors = () => {
    setFormError("");
    setFieldErrors({});
  };

  const switchToCreateMode = () => {
    if (isDemo) return;
    setIsCreating(true);
    setIsEditing(false);
    setSelectedPromptId(null);
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
    setActivePlaceholderKey(null);
    setFormState(toPromptInputState(prompt));
    setActivePreviewTab("rendered");
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
    if (isDemo) return;

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
    } catch {
      showToast("本文コピーに失敗しました", "error");
    }
  }, [renderedBody, showToast]);

  const copyMarkdownText = useCallback(async () => {
    const markdownText = `\`\`\`\n${renderedBody}\n\`\`\``;
    try {
      await navigator.clipboard.writeText(markdownText);
      showToast("Markdown整形コピーしました", "success");
    } catch {
      showToast("Markdown整形コピーに失敗しました", "error");
    }
  }, [renderedBody, showToast]);

  const clearPlaceholderValues = useCallback(() => {
    setPlaceholderValues({});
    setPlaceholderUndoValues({});
    localStorage.removeItem(placeholderValuesStorageKey);
  }, [placeholderValuesStorageKey]);

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
  const renderPlaceholderField = (key: string) => {
    const schema = getPlaceholderFieldSchema(key);
    const isLongText = schema?.type === "longText" || (!schema && isLongTextPlaceholder(key));
    const label = schema?.label ?? `{{${key}}}`;
    const placeholderText = schema?.placeholder ?? (isLongText ? "複数行の入力に対応" : "値を入力");

    return (
      <div key={key} className="space-y-1">
        <label className="text-sm font-medium" htmlFor={`placeholder-${key}`}>
          {label}
        </label>
        {isLongText ? (
          <div className="space-y-2">
            <Textarea
              id={`placeholder-${key}`}
              data-pv={getPlaceholderInputSelector(key)}
              rows={6}
              className="resize-y font-mono"
              placeholder={placeholderText}
              value={placeholderValues[key] ?? ""}
              onFocus={() => setActivePlaceholderKey(key)}
              onBlur={() => setActivePlaceholderKey(null)}
              onChange={(event) =>
                setPlaceholderValues((prev) => ({
                  ...prev,
                  [key]: event.target.value,
                }))
              }
            />
            {isLogsPlaceholder(key) ? (
              <div className="space-y-2">
                <p
                  className="text-xs text-muted-foreground"
                  data-pv={getPlaceholderLogLineCountSelector(key)}
                >
                  行数: {splitLines(placeholderValues[key] ?? "").length}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fillPlaceholderExamples}
                    disabled={!canFillPlaceholderExamples}
                    title="空欄のうち、サンプルが定義されている項目だけ埋めます"
                    data-pv={PV_SELECTORS.fillPlaceholderExamplesButton}
                  >
                    空欄にサンプル
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-pv={getPlaceholderLogActionSelector(key, "head")}
                    title={`先頭から${LOG_TRIM_LINE_COUNT}行だけ残します`}
                    onClick={() =>
                      applyErrorLogsTransform(key, (value) =>
                        toHeadLines(value, LOG_TRIM_LINE_COUNT),
                      )
                    }
                  >
                    先頭{LOG_TRIM_LINE_COUNT}行
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-pv={getPlaceholderLogActionSelector(key, "tail")}
                    title={`末尾から${LOG_TRIM_LINE_COUNT}行だけ残します`}
                    onClick={() =>
                      applyErrorLogsTransform(key, (value) =>
                        toTailLines(value, LOG_TRIM_LINE_COUNT),
                      )
                    }
                  >
                    末尾{LOG_TRIM_LINE_COUNT}行
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-pv={getPlaceholderLogActionSelector(key, "head-tail")}
                    title={`先頭${LOG_TRIM_LINE_COUNT}行と末尾${LOG_TRIM_LINE_COUNT}行だけ残します`}
                    onClick={() =>
                      applyErrorLogsTransform(key, (value) =>
                        toHeadTailLines(value, LOG_TRIM_LINE_COUNT),
                      )
                    }
                  >
                    先頭+末尾
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-pv={getPlaceholderLogActionSelector(key, "undo")}
                    title="直前の短縮を取り消します"
                    onClick={() => restoreErrorLogsValue(key)}
                    disabled={placeholderUndoValues[key] === undefined}
                  >
                    元に戻す
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <Input
            id={`placeholder-${key}`}
            data-pv={getPlaceholderInputSelector(key)}
            placeholder={placeholderText}
            value={placeholderValues[key] ?? ""}
            onFocus={() => setActivePlaceholderKey(key)}
            onBlur={() => setActivePlaceholderKey(null)}
            onChange={(event) =>
              setPlaceholderValues((prev) => ({
                ...prev,
                [key]: event.target.value,
              }))
            }
          />
        )}
      </div>
    );
  };

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
        className="h-[calc(100vh-56px)] min-h-0 overflow-hidden"
        style={{
          display: "grid",
          gridTemplateColumns: `${leftPaneWidth}px 8px 1fr`,
        }}
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
                    {!isDemo ? (
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
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <div
          data-pv={PV_SELECTORS.splitterHandle}
          onPointerDown={onSplitterPointerDown}
          className="h-full w-full cursor-col-resize bg-transparent hover:bg-muted/40"
          style={{ touchAction: "none" }}
        />

        <main className="flex flex-1 flex-col overflow-hidden p-6">
          {!isFormMode && !selectedPrompt ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
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

              <div className="space-y-2 border-b bg-background pb-3">
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

              <div className="grid min-h-0 flex-1 gap-4 pt-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <section className="flex min-h-0 flex-col overflow-hidden rounded-md border bg-muted/20 p-4">
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
                          {placeholders.map((key) => renderPlaceholderField(key))}
                        </div>
                      </ScrollArea>
                    </>
                  ) : (
                    <div className="mt-3 rounded-md border border-dashed bg-background/60 p-4 text-sm text-muted-foreground">
                      このプロンプトにはプレースホルダがありません。
                    </div>
                  )}
                </section>

                <section className="flex min-h-0 flex-col overflow-hidden rounded-md border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div
                      className="inline-flex rounded-lg border bg-muted p-1.5 shadow-sm"
                      role="tablist"
                      aria-label="プレビュー切り替え"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activePreviewTab === "rendered"}
                        aria-controls="preview-rendered-panel"
                        id="preview-rendered-tab"
                        className={cn(
                          "rounded-md px-3 py-1.5 text-sm transition-all",
                          activePreviewTab === "rendered"
                            ? "bg-primary text-primary-foreground font-semibold shadow-sm ring-1 ring-primary/40"
                            : "text-foreground/70 hover:bg-background/80 hover:text-foreground",
                        )}
                        onClick={() => setActivePreviewTab("rendered")}
                      >
                        レンダリング結果
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={activePreviewTab === "original"}
                        aria-controls="preview-original-panel"
                        id="preview-original-tab"
                        className={cn(
                          "rounded-md px-3 py-1.5 text-sm transition-all",
                          activePreviewTab === "original"
                            ? "bg-primary text-primary-foreground font-semibold shadow-sm ring-1 ring-primary/40"
                            : "text-foreground/70 hover:bg-background/80 hover:text-foreground",
                        )}
                        onClick={() => setActivePreviewTab("original")}
                      >
                        元の文章
                      </button>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
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
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={copyMarkdownText}
                        title="ログ/コードを ``` で囲ってコピーします"
                        data-pv={PV_SELECTORS.copyMarkdownButton}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Markdown整形コピー
                      </Button>
                    </div>
                  </div>

                  <div
                    id="preview-rendered-panel"
                    role="tabpanel"
                    aria-labelledby="preview-rendered-tab"
                    className={cn(
                      "mt-3 min-h-0 flex-1 flex-col space-y-2",
                      activePreviewTab === "rendered" ? "flex" : "hidden",
                    )}
                  >
                    <ScrollArea
                      data-pv={PV_SELECTORS.renderedOutput}
                      className="min-h-0 flex-1 whitespace-pre-wrap rounded-md bg-muted/30 p-3"
                    >
                      {renderedPreviewNodes}
                    </ScrollArea>
                  </div>

                  <div
                    id="preview-original-panel"
                    role="tabpanel"
                    aria-labelledby="preview-original-tab"
                    className={cn(
                      "mt-3 min-h-0 flex-1 flex-col space-y-2",
                      activePreviewTab === "original" ? "flex" : "hidden",
                    )}
                  >
                    <ScrollArea className="min-h-0 flex-1 whitespace-pre-wrap rounded-md bg-muted/30 p-3">
                      {selectedPrompt.body}
                    </ScrollArea>
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
