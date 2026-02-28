import type { Prompt } from "@prisma/client";

import { promptSchema } from "@/schemas/prompt";
import {
  createPrompt,
  deletePrompt,
  findPromptByIdAndOwner,
  listPromptsByOwner,
  setPromptPinState,
  updatePrompt,
} from "@/server/repositories/prompt-repository";
import { getCurrentAppUser } from "@/server/services/auth-service";
import type { ActionResult } from "@/types/action-result";
import { err, ok } from "@/types/action-result";

type PromptPayload = {
  title: string;
  body: string;
  tags: string[];
};

export const listMyPrompts = async (): Promise<ActionResult<Prompt[]>> => {
  const appUserResult = await getCurrentAppUser();
  if (appUserResult.error) {
    return appUserResult;
  }

  try {
    const prompts = await listPromptsByOwner(appUserResult.data.id);
    return ok(prompts);
  } catch {
    return err("DB_ERROR", "プロンプト一覧の取得に失敗しました");
  }
};

export const createMyPrompt = async (payload: PromptPayload): Promise<ActionResult<Prompt>> => {
  const appUserResult = await getCurrentAppUser();
  if (appUserResult.error) {
    return appUserResult;
  }

  const validated = promptSchema.safeParse(payload);
  if (!validated.success) {
    const firstMessage = validated.error.issues[0]?.message ?? "入力値が不正です";
    return err("VALIDATION_ERROR", firstMessage);
  }

  try {
    const prompt = await createPrompt(appUserResult.data.id, validated.data);
    return ok(prompt);
  } catch {
    return err("DB_ERROR", "プロンプトの保存に失敗しました");
  }
};

export const updateMyPrompt = async (
  promptId: string,
  payload: PromptPayload,
): Promise<ActionResult<Prompt>> => {
  const appUserResult = await getCurrentAppUser();
  if (appUserResult.error) {
    return appUserResult;
  }

  const validated = promptSchema.safeParse(payload);
  if (!validated.success) {
    const firstMessage = validated.error.issues[0]?.message ?? "入力値が不正です";
    return err("VALIDATION_ERROR", firstMessage);
  }

  try {
    const existingPrompt = await findPromptByIdAndOwner(promptId, appUserResult.data.id);
    if (!existingPrompt) {
      return err("NOT_FOUND", "対象のプロンプトが見つかりません");
    }

    const prompt = await updatePrompt(promptId, appUserResult.data.id, validated.data);
    return ok(prompt);
  } catch {
    return err("DB_ERROR", "プロンプトの更新に失敗しました");
  }
};

export const toggleMyPromptPin = async (promptId: string): Promise<ActionResult<Prompt[]>> => {
  const appUserResult = await getCurrentAppUser();
  if (appUserResult.error) {
    return appUserResult;
  }

  try {
    const existingPrompt = await findPromptByIdAndOwner(promptId, appUserResult.data.id);
    if (!existingPrompt) {
      return err("NOT_FOUND", "対象のプロンプトが見つかりません");
    }

    const prompts = await setPromptPinState(
      appUserResult.data.id,
      promptId,
      existingPrompt.pinnedAt === null,
    );

    return ok(prompts);
  } catch (errorn) {
    if (errorn instanceof Error && errorn.message === "PROMPT_NOT_FOUND") {
      return err("NOT_FOUND", "対象のプロンプトが見つかりません");
    }

    return err("DB_ERROR", "プロンプトのピン設定の更新に失敗しました");
  }
};

export const deleteMyPrompt = async (promptId: string): Promise<ActionResult<{ id: string }>> => {
  const appUserResult = await getCurrentAppUser();
  if (appUserResult.error) {
    return appUserResult;
  }

  try {
    const existingPrompt = await findPromptByIdAndOwner(promptId, appUserResult.data.id);
    if (!existingPrompt) {
      return err("NOT_FOUND", "対象のプロンプトが見つかりません");
    }

    await deletePrompt(promptId);
    return ok({ id: promptId });
  } catch {
    return err("DB_ERROR", "プロンプトの削除に失敗しました");
  }
};
