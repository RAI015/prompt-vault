import { type NextRequest, NextResponse } from "next/server";

import { isEmailAllowed } from "@/lib/env";
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
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=forbidden", request.url));
  }

  const syncResult = await syncCurrentAppUser();
  if (syncResult.error) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.redirect(new URL("/app/prompts", request.url));
}
