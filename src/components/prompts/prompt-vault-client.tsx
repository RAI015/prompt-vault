"use client";

import type { Prompt } from "@prisma/client";
import { Braces, Copy, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
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
import { createClient } from "@/lib/supabase/client";
import { parseTagCsv, promptSchema } from "@/schemas/prompt";
import {
  createPromptAction,
  deletePromptAction,
  updatePromptAction,
} from "@/server/actions/prompt-actions";
import { extractPlaceholders, renderTemplate } from "@/utils/placeholder";

type PromptInputState = {
  title: string;
  body: string;
  tagsCsv: string;
};

const toPromptInputState = (prompt?: Prompt): PromptInputState => ({
  title: prompt?.title ?? "",
  body: prompt?.body ?? "",
  tagsCsv: prompt?.tags.join(", ") ?? "",
});

const isLongTextPlaceholder = (key: string): boolean => {
  return /(log|body|text|content|detail|error|stack|message|context|note)/i.test(key);
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

export const PromptVaultClient = ({ initialPrompts }: { initialPrompts: Prompt[] }) => {
  const [prompts, setPrompts] = useState<Prompt[]>(initialPrompts);
  const [search, setSearch] = useState("");
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(
    initialPrompts[0]?.id ?? null,
  );
  const [isCreating, setIsCreating] = useState(initialPrompts.length === 0);
  const [isEditing, setIsEditing] = useState(false);
  const [formState, setFormState] = useState<PromptInputState>(() =>
    toPromptInputState(initialPrompts[0]),
  );
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; body?: string; tags?: string }>(
    {},
  );
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);

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

  const placeholders = extractPlaceholders(selectedPrompt?.body ?? formState.body);
  const renderedBody = renderTemplate(selectedPrompt?.body ?? formState.body, placeholderValues);

  const resetFormErrors = () => {
    setFormError("");
    setFieldErrors({});
  };

  const switchToCreateMode = () => {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedPromptId(null);
    setFormState(toPromptInputState());
    setPlaceholderValues({});
    setToast(null);
    resetFormErrors();
  };

  const selectPrompt = (prompt: Prompt) => {
    setSelectedPromptId(prompt.id);
    setIsCreating(false);
    setIsEditing(false);
    setFormState(toPromptInputState(prompt));
    setPlaceholderValues({});
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

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(renderedBody);
      showToast("コピーしました", "success");
    } catch {
      showToast("コピーに失敗しました", "error");
    }
  }, [renderedBody, showToast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) {
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
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.code === "KeyC" && event.altKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        void onCopy();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onCopy]);

  const isFormMode = isCreating || isEditing;

  return (
    <div className="h-screen overflow-hidden">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <div className="font-semibold">Prompt Vault</div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="outline" onClick={logout} disabled={isPending}>
            ログアウト
          </Button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)]">
        <aside className="w-[280px] border-r">
          <div className="space-y-3 p-3">
            <Button className="w-full" onClick={switchToCreateMode}>
              <Plus className="mr-2 h-4 w-4" />
              新規作成
            </Button>
            <div className="space-y-1">
              <label htmlFor="prompt-search" className="text-xs font-medium text-muted-foreground">
                検索
              </label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="prompt-search"
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

          <ScrollArea className="h-[calc(100vh-56px-108px)] px-3 pb-3">
            <div className="space-y-2">
              {filteredPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  type="button"
                  onClick={() => selectPrompt(prompt)}
                  className={`w-full rounded-md p-2 text-left ${
                    selectedPromptId === prompt.id && !isFormMode ? "bg-accent" : "hover:bg-muted"
                  }`}
                >
                  <p className="line-clamp-1 text-sm font-medium">{prompt.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {prompt.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {!isFormMode && !selectedPrompt ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              プロンプトを選択してください
            </div>
          ) : null}

          {isFormMode ? (
            <div className="mx-auto max-w-4xl space-y-4">
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
                  placeholder="例: design, prompt, gpt"
                  value={formState.tagsCsv}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, tagsCsv: event.target.value }))
                  }
                />
                <ErrorText>{fieldErrors.tags}</ErrorText>
              </div>

              <div className="flex gap-2">
                <Button onClick={savePrompt} disabled={isPending} className="gap-2">
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
            <div className="mx-auto max-w-4xl space-y-4">
              {formError ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              ) : null}

              <div>
                <h2 className="text-2xl font-bold">{selectedPrompt.title}</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedPrompt.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>

              <ScrollArea className="max-h-64 rounded-md border bg-muted/30 p-4 whitespace-pre-wrap">
                {selectedPrompt.body}
              </ScrollArea>

              {placeholders.length > 0 ? (
                <div className="space-y-3 rounded-md border bg-muted/20 p-4">
                  <div className="flex items-center gap-2">
                    <Braces className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium">プレースホルダ入力</h3>
                    <Badge variant="secondary">{placeholders.length}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    「{"{{...}}"}」ごとの値を入力すると、下の「レンダリング結果」に反映されます。
                  </p>
                  {placeholders.map((key) => (
                    <div key={key} className="space-y-1">
                      <label className="text-sm font-medium" htmlFor={`placeholder-${key}`}>
                        {`{{${key}}}`}
                      </label>
                      {isLongTextPlaceholder(key) ? (
                        <Textarea
                          id={`placeholder-${key}`}
                          rows={6}
                          className="resize-y font-mono"
                          placeholder="複数行の入力に対応"
                          value={placeholderValues[key] ?? ""}
                          onChange={(event) =>
                            setPlaceholderValues((prev) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
                          }
                        />
                      ) : (
                        <Input
                          id={`placeholder-${key}`}
                          placeholder="値を入力"
                          value={placeholderValues[key] ?? ""}
                          onChange={(event) =>
                            setPlaceholderValues((prev) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-2 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">レンダリング結果</h3>
                  <Button variant="outline" size="sm" onClick={onCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    コピー
                    <kbd className="ml-2 rounded border px-1 text-[10px] leading-4 text-muted-foreground">
                      ⌥C
                    </kbd>
                  </Button>
                </div>
                <ScrollArea className="max-h-64 whitespace-pre-wrap rounded-md bg-muted/30 p-3">
                  {renderedBody}
                </ScrollArea>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button variant="outline" onClick={startEdit}>
                  <Pencil className="mr-2 h-4 w-4" />
                  編集
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
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
            </div>
          ) : null}
        </main>
      </div>
      {toast ? (
        <div
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
