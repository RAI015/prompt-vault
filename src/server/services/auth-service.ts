import type { AppUser } from "@prisma/client";
import type { User } from "@supabase/supabase-js";

import { isEmailAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { findAppUserByAuthSubject, upsertAppUser } from "@/server/repositories/app-user-repository";
import type { ActionResult } from "@/types/action-result";
import { err, ok } from "@/types/action-result";

export const getSessionUser = async (): Promise<ActionResult<User>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return err("UNAUTHORIZED", "ログインが必要です");
  }

  if (!isEmailAllowed(data.user.email)) {
    await supabase.auth.signOut();
    return err("FORBIDDEN", "このアカウントではアクセスできません");
  }

  return ok(data.user);
};

export const syncCurrentAppUser = async (): Promise<ActionResult<AppUser>> => {
  const sessionUserResult = await getSessionUser();
  if (sessionUserResult.error) {
    return sessionUserResult;
  }

  try {
    const user = sessionUserResult.data;
    const appUser = await upsertAppUser({
      authProvider: "supabase",
      authSubject: user.id,
      email: user.email,
    });

    return ok(appUser);
  } catch {
    return err("DB_ERROR", "ユーザー情報の保存に失敗しました");
  }
};

export const getCurrentAppUser = async (): Promise<ActionResult<AppUser>> => {
  const sessionUserResult = await getSessionUser();
  if (sessionUserResult.error) {
    return sessionUserResult;
  }

  try {
    const appUser = await findAppUserByAuthSubject(sessionUserResult.data.id);
    if (!appUser) {
      return err("USER_NOT_FOUND", "ユーザー情報の同期に失敗しました");
    }

    return ok(appUser);
  } catch {
    return err("DB_ERROR", "ユーザー情報の取得に失敗しました");
  }
};
