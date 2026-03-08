import type { PromptLike } from "@/components/prompts/prompt-vault-types";

const LONGTEXT_SUFFIXES = ["logs", "text", "details", "content", "body", "notes"] as const;
const LONGTEXT_RE = new RegExp(`(^|_)(${LONGTEXT_SUFFIXES.join("|")})($|_)`, "i");

export const LOG_TRIM_LINE_COUNT = 50;
export const SERVICE_PLACEHOLDER_KEY = "service";
export const SERVICE_OTHER_VALUE = "other";

export const isLongTextPlaceholder = (key: string): boolean => LONGTEXT_RE.test(key);

export const isLogsPlaceholder = (key: string): boolean => {
  return key.toLowerCase().endsWith("_logs");
};

export const splitLines = (value: string): string[] => {
  if (!value) {
    return [];
  }
  return value.split(/\r?\n/);
};

export const toHeadLines = (value: string, lineCount: number): string => {
  return splitLines(value).slice(0, lineCount).join("\n");
};

export const toTailLines = (value: string, lineCount: number): string => {
  const lines = splitLines(value);
  return lines.slice(Math.max(0, lines.length - lineCount)).join("\n");
};

export const toHeadTailLines = (value: string, lineCount: number): string => {
  const lines = splitLines(value);
  if (lines.length <= lineCount * 2) {
    return value;
  }
  const omitted = lines.length - lineCount * 2;
  const head = lines.slice(0, lineCount);
  const tail = lines.slice(lines.length - lineCount);
  return [...head, `... (${omitted} lines omitted) ...`, ...tail].join("\n");
};

export const normalizePinnedPromptIds = (ids: string[], maxPinnedPrompts: number): string[] => {
  const uniqueIds: string[] = [];
  for (const id of ids) {
    if (uniqueIds.includes(id)) {
      continue;
    }
    uniqueIds.push(id);
    if (uniqueIds.length >= maxPinnedPrompts) {
      break;
    }
  }
  return uniqueIds;
};

export const resolveDemoPinnedIdsFromStorage = (
  value: unknown,
  maxPinnedPrompts: number,
): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const validIds = value.filter((entry): entry is string => typeof entry === "string");
  return normalizePinnedPromptIds(validIds, maxPinnedPrompts);
};

export const computeNextPinnedIds = (
  currentPinnedIds: string[],
  toggledPromptId: string,
  isCurrentlyPinned: boolean,
  maxPinnedPrompts: number,
): string[] => {
  const normalizedCurrent = normalizePinnedPromptIds(currentPinnedIds, maxPinnedPrompts);
  if (isCurrentlyPinned) {
    return normalizedCurrent.filter((id) => id !== toggledPromptId);
  }

  const nextPinnedIds = normalizedCurrent.filter((id) => id !== toggledPromptId);
  if (nextPinnedIds.length >= maxPinnedPrompts) {
    nextPinnedIds.shift();
  }
  nextPinnedIds.push(toggledPromptId);
  return nextPinnedIds;
};

export const applyPinnedStateToPrompts = (
  prompts: PromptLike[],
  pinnedIds: string[],
): PromptLike[] => {
  const baseTime = Date.UTC(2000, 0, 1, 0, 0, 0, 0);
  const pinnedAtById = new Map(
    pinnedIds.map((id, index) => [id, new Date(baseTime + index)] as const),
  );
  return prompts.map((prompt) => ({
    ...prompt,
    pinnedAt: pinnedAtById.get(prompt.id) ?? null,
  }));
};

export const normalizeValuesByPlaceholders = (
  keys: string[],
  values: Record<string, string>,
): Record<string, string> => {
  return Object.fromEntries(keys.map((key) => [key, values[key] ?? ""]));
};

export const isAllPlaceholdersEmpty = (keys: string[], values: Record<string, string>): boolean => {
  return keys.every((key) => (values[key] ?? "").trim().length === 0);
};

export const isRecordString = (value: unknown): value is Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
};

export const toAbsoluteDateLabel = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
};

export const toRelativeDateLabel = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "日時不明";
  }
  const rawDiffMs = date.getTime() - Date.now();
  // 履歴用途では未来時刻を0に丸め、過去経過だけを表示する。
  const pastDiffMs = Math.min(rawDiffMs, 0);
  const elapsedSeconds = Math.floor(Math.abs(pastDiffMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat("ja", { numeric: "auto" });

  if (elapsedSeconds < 60) {
    return "0分前";
  }
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return rtf.format(-elapsedMinutes, "minute");
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return rtf.format(-elapsedHours, "hour");
  }
  const elapsedDays = Math.floor(elapsedHours / 24);
  return rtf.format(-elapsedDays, "day");
};

export const sortPromptsByPinnedAt = (
  prompts: PromptLike[],
  orderMap: Map<string, number>,
): PromptLike[] => {
  return [...prompts].sort((left, right) => {
    if (left.pinnedAt && right.pinnedAt) {
      const pinnedAtDiff = right.pinnedAt.getTime() - left.pinnedAt.getTime();
      if (pinnedAtDiff !== 0) {
        return pinnedAtDiff;
      }
      return (
        (orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );
    }
    if (left.pinnedAt) {
      return -1;
    }
    if (right.pinnedAt) {
      return 1;
    }

    return (
      (orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );
  });
};
