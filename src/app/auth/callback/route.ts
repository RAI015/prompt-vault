import { type NextRequest, NextResponse } from "next/server";

import { isEmailAllowed } from "@/lib/env";
import { log, toMaskedEmail } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { syncCurrentAppUser } from "@/server/services/auth-service";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    log("warn", "oauth callback missing code");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  await supabase.auth.exchangeCodeForSession(code);

  const { data } = await supabase.auth.getUser();
  if (!isEmailAllowed(data.user?.email)) {
    log("warn", "oauth callback deny by allowlist", {
      email: toMaskedEmail(data.user?.email),
    });
    await supabase.auth.signOut();
    const redirectResponse = NextResponse.redirect(new URL("/login?error=forbidden", request.url));
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-")) {
        redirectResponse.cookies.set(cookie.name, "", {
          path: "/",
          maxAge: 0,
        });
      }
    }
    return redirectResponse;
  }

  const syncResult = await syncCurrentAppUser();
  if (syncResult.error) {
    log("error", "oauth callback app user sync failed", {
      code: syncResult.error.code,
      message: syncResult.error.message,
    });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  log("info", "oauth callback success", { email: toMaskedEmail(data.user?.email) });
  return NextResponse.redirect(new URL("/app/prompts", request.url));
}
