"use server";

import { syncCurrentAppUser } from "@/server/services/auth-service";
import type { ActionResult } from "@/types/action-result";

export const syncCurrentUserAction = async (): Promise<ActionResult<{ id: string }>> => {
  try {
    const result = await syncCurrentAppUser();
    if (result.error) {
      return result;
    }

    return {
      data: { id: result.data.id },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "ユーザー情報の同期に失敗しました",
      },
    };
  }
};
