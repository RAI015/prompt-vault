import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { isEmailAllowed } from "@/lib/env";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

const protectedPath = "/app/prompts";

export const middleware = async (request: NextRequest) => {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
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
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "forbidden");
    return NextResponse.redirect(url);
  }

  if (path.startsWith(protectedPath) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (path === "/login" && user && isEmailAllowed(user.email)) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/prompts";
    return NextResponse.redirect(url);
  }

  return response;
};

export const config = {
  matcher: ["/app/prompts/:path*", "/login", "/auth/callback"],
};
