import { type NextRequest, NextResponse } from "next/server";

import { isEmailAllowed } from "@/lib/env";
import { error, toMaskedEmail, warn } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { syncCurrentAppUser } from "@/server/services/auth-service";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  await supabase.auth.exchangeCodeForSession(code);

  const { data } = await supabase.auth.getUser();
  if (!isEmailAllowed(data.user?.email)) {
    warn("oauth callback deny by allowlist", {
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
    error("oauth callback app user sync failed", {
      code: syncResult.error.code,
      message: syncResult.error.message,
    });
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.redirect(new URL("/app/prompts", request.url));
}
