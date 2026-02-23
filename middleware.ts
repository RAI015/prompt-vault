import { type SetAllCookies, createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { isEmailAllowed } from "@/lib/env";
import { log, toMaskedEmail } from "@/lib/log";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

const protectedPath = "/app/prompts";

export const middleware = async (request: NextRequest) => {
  let response = NextResponse.next({ request });
  const redirectWithCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    }
    return redirectResponse;
  };

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
        }
        response = NextResponse.next({ request });
        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie.name, cookie.value, cookie.options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  if (user && !isEmailAllowed(user.email)) {
    log("warn", "middleware deny by allowlist", {
      path,
      email: toMaskedEmail(user.email),
    });
    await supabase.auth.signOut();
    const isForbiddenLogin =
      path === "/login" && request.nextUrl.searchParams.get("error") === "forbidden";
    if (isForbiddenLogin) {
      return response;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "forbidden");
    return redirectWithCookies(url);
  }

  if (path.startsWith(protectedPath) && !user) {
    log("info", "middleware redirect unauthorized to login", { path });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
};

export const config = {
  matcher: ["/app/prompts/:path*", "/login", "/auth/callback"],
};
