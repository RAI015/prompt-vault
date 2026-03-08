import type { PromptLike } from "@/components/prompts/prompt-vault-types";
import {
  applyPinnedStateToPrompts,
  computeNextPinnedIds,
  sortPromptsByPinnedAt,
} from "@/components/prompts/prompt-vault-utils";
import { createClient } from "@/lib/supabase/client";
import {
  createPromptAction,
  deletePromptAction,
  togglePromptPinAction,
  updatePromptAction,
} from "@/server/actions/prompt-actions";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useTransition } from "react";

const DEMO_PINNED_PROMPT_IDS_STORAGE_KEY = "pv:demoPinnedPromptIds";
const DEMO_MAX_PINNED_PROMPTS = 6;

type SavePromptPayload = {
  title: string;
  body: string;
  tags: string[];
};

type SavePromptParams = {
  payload: SavePromptPayload;
  isCreating: boolean;
  selectedPromptId: string | null;
};

type UsePromptCrudParams = {
  isDemo: boolean;
  prompts: PromptLike[];
  promptOrderMap: Map<string, number>;
  setPrompts: Dispatch<SetStateAction<PromptLike[]>>;
  setFormError: Dispatch<SetStateAction<string>>;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  selectPrompt: (prompt: PromptLike) => void;
  onPromptsEmpty: () => void;
};

export const usePromptCrud = ({
  isDemo,
  prompts,
  promptOrderMap,
  setPrompts,
  setFormError,
  setIsEditing,
  selectPrompt,
  onPromptsEmpty,
}: UsePromptCrudParams) => {
  const [isPending, startTransition] = useTransition();

  const savePrompt = useCallback(
    ({ payload, isCreating, selectedPromptId }: SavePromptParams) => {
      if (isDemo) {
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
    },
    [isDemo, selectPrompt, setFormError, setIsEditing, setPrompts],
  );

  const removePrompt = useCallback(
    (promptId: string) => {
      if (isDemo) {
        return;
      }

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
          onPromptsEmpty();
        }
      });
    },
    [isDemo, onPromptsEmpty, prompts, selectPrompt, setFormError, setPrompts],
  );

  const togglePin = useCallback(
    (promptId: string) => {
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
    },
    [isDemo, promptOrderMap, setFormError, setPrompts],
  );

  const logout = useCallback(() => {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    });
  }, []);

  return {
    isPending,
    savePrompt,
    removePrompt,
    togglePin,
    logout,
  };
};
