"use server";

import type { Prompt } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createMyPrompt, deleteMyPrompt, updateMyPrompt } from "@/server/services/prompt-service";
import type { ActionResult } from "@/types/action-result";

type PromptActionPayload = {
  title: string;
  body: string;
  tags: string[];
};

export const createPromptAction = async (
  payload: PromptActionPayload,
): Promise<ActionResult<Prompt>> => {
  try {
    const result = await createMyPrompt(payload);
    if (result.error) {
      return result;
    }

    revalidatePath("/app/prompts");
    return { data: result.data, error: null };
  } catch {
    return {
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "保存に失敗しました。再度お試しください。",
      },
    };
  }
};

export const updatePromptAction = async (
  promptId: string,
  payload: PromptActionPayload,
): Promise<ActionResult<Prompt>> => {
  try {
    const result = await updateMyPrompt(promptId, payload);
    if (result.error) {
      return result;
    }

    revalidatePath("/app/prompts");
    return { data: result.data, error: null };
  } catch {
    return {
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "更新に失敗しました。再度お試しください。",
      },
    };
  }
};

export const deletePromptAction = async (
  promptId: string,
): Promise<ActionResult<{ id: string }>> => {
  try {
    const result = await deleteMyPrompt(promptId);
    if (result.error) {
      return result;
    }

    revalidatePath("/app/prompts");
    return result;
  } catch {
    return {
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "削除に失敗しました。再度お試しください。",
      },
    };
  }
};
