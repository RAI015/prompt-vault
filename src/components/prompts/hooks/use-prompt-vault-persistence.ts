import type {
  CopyHistoryEntry,
  PromptLike,
  PromptVaultMode,
} from "@/components/prompts/prompt-vault-types";
import {
  applyPinnedStateToPrompts,
  getCopyHistoryStorageKey,
  getPlaceholderValuesStorageKey,
  getSelectedPromptIdStorageKey,
  isRecordString,
  normalizeValuesByPlaceholders,
  resolveDemoPinnedIdsFromStorage,
  sortPromptsByPinnedAt,
} from "@/components/prompts/prompt-vault-utils";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

type UsePromptVaultPersistenceParams = {
  mode: PromptVaultMode;
  isDemo: boolean;
  initialPrompts: PromptLike[];
  promptOrderMap: Map<string, number>;
  prompts: PromptLike[];
  selectedPromptId: string | null;
  setSelectedPromptId: Dispatch<SetStateAction<string | null>>;
  placeholderValues: Record<string, string>;
  setPlaceholderValues: Dispatch<SetStateAction<Record<string, string>>>;
  placeholders: string[];
  setCopyHistory: Dispatch<SetStateAction<CopyHistoryEntry | null>>;
  setPrompts: Dispatch<SetStateAction<PromptLike[]>>;
};

const DEMO_PINNED_PROMPT_IDS_STORAGE_KEY = "pv:demoPinnedPromptIds";
const DEMO_MAX_PINNED_PROMPTS = 6;

export const usePromptVaultPersistence = ({
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
}: UsePromptVaultPersistenceParams): { isSelectedPromptIdRestored: boolean } => {
  const [isSelectedPromptIdRestored, setIsSelectedPromptIdRestored] = useState(false);

  const placeholderValuesStorageKey = getPlaceholderValuesStorageKey(mode);
  const selectedPromptIdStorageKey = getSelectedPromptIdStorageKey(mode);

  useEffect(() => {
    if (!isDemo) {
      return;
    }

    const raw = localStorage.getItem(DEMO_PINNED_PROMPT_IDS_STORAGE_KEY);
    if (!raw) {
      setPrompts(sortPromptsByPinnedAt(initialPrompts, promptOrderMap));
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const pinnedIds = resolveDemoPinnedIdsFromStorage(parsed, DEMO_MAX_PINNED_PROMPTS);
      if (pinnedIds.length === 0) {
        localStorage.removeItem(DEMO_PINNED_PROMPT_IDS_STORAGE_KEY);
      } else {
        const serializedPinnedIds = JSON.stringify(pinnedIds);
        if (serializedPinnedIds !== raw) {
          localStorage.setItem(DEMO_PINNED_PROMPT_IDS_STORAGE_KEY, serializedPinnedIds);
        }
      }
      const nextPrompts = applyPinnedStateToPrompts(initialPrompts, pinnedIds);
      setPrompts(sortPromptsByPinnedAt(nextPrompts, promptOrderMap));
    } catch {
      localStorage.removeItem(DEMO_PINNED_PROMPT_IDS_STORAGE_KEY);
      setPrompts(sortPromptsByPinnedAt(initialPrompts, promptOrderMap));
    }
  }, [initialPrompts, isDemo, promptOrderMap, setPrompts]);

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
  }, [placeholderValuesStorageKey, setPlaceholderValues]);

  useEffect(() => {
    const storedSelectedPromptId = localStorage.getItem(selectedPromptIdStorageKey);
    if (!storedSelectedPromptId) {
      setIsSelectedPromptIdRestored(true);
      return;
    }
    if (!prompts.some((prompt) => prompt.id === storedSelectedPromptId)) {
      localStorage.removeItem(selectedPromptIdStorageKey);
      setIsSelectedPromptIdRestored(true);
      return;
    }
    setSelectedPromptId(storedSelectedPromptId);
    setIsSelectedPromptIdRestored(true);
  }, [prompts, selectedPromptIdStorageKey, setSelectedPromptId]);

  useEffect(() => {
    if (!isSelectedPromptIdRestored) {
      return;
    }
    if (!selectedPromptId) {
      localStorage.removeItem(selectedPromptIdStorageKey);
      return;
    }
    localStorage.setItem(selectedPromptIdStorageKey, selectedPromptId);
  }, [isSelectedPromptIdRestored, selectedPromptId, selectedPromptIdStorageKey]);

  useEffect(() => {
    if (Object.keys(placeholderValues).length === 0) {
      localStorage.removeItem(placeholderValuesStorageKey);
      return;
    }

    localStorage.setItem(placeholderValuesStorageKey, JSON.stringify(placeholderValues));
  }, [placeholderValues, placeholderValuesStorageKey]);

  useEffect(() => {
    if (!selectedPromptId) {
      setCopyHistory(null);
      return;
    }

    const historyStorageKey = getCopyHistoryStorageKey(mode, selectedPromptId);
    const raw = localStorage.getItem(historyStorageKey);
    if (!raw) {
      setCopyHistory(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        localStorage.removeItem(historyStorageKey);
        setCopyHistory(null);
        return;
      }

      const createdAt =
        "createdAt" in parsed && typeof parsed.createdAt === "string" ? parsed.createdAt : null;
      const title = "title" in parsed && typeof parsed.title === "string" ? parsed.title : null;
      const values = "values" in parsed ? parsed.values : null;

      if (!createdAt || !title || !isRecordString(values)) {
        localStorage.removeItem(historyStorageKey);
        setCopyHistory(null);
        return;
      }

      setCopyHistory({
        createdAt,
        title,
        values: normalizeValuesByPlaceholders(placeholders, values),
      });
    } catch {
      localStorage.removeItem(historyStorageKey);
      setCopyHistory(null);
    }
  }, [mode, placeholders, selectedPromptId, setCopyHistory]);

  return { isSelectedPromptIdRestored };
};
