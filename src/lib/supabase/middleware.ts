import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

/** Routes accessible without a session */
const PUBLIC_ROUTES = ["/login"] as const;

/** Route prefixes accessible without a session */
const PUBLIC_PREFIXES = ["/auth/callback", "/api/webhooks"] as const;

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname as (typeof PUBLIC_ROUTES)[number])) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRoute(pathname: string): boolean {
  return pathname === "/login";
}

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/** Apply refreshed Supabase session cookies to any response. */
function applySessionCookies(
  response: NextResponse,
  cookiesToSet: CookieToSet[]
): NextResponse {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

/**
 * Refreshes the Supabase session and enforces route protection.
 * - Unauthenticated users on protected routes → /login
 * - Authenticated users on /login → /dashboard
 * - Never redirects authenticated users away from /dashboard
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const sessionCookies: CookieToSet[] = [];

  let supabaseUrl: string;
  let anonKey: string;

  try {
    ({ url: supabaseUrl, anonKey } = getPublicSupabaseConfig());
  } catch (err) {
    console.error("[auth middleware] Supabase config missing:", err);
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          sessionCookies.push({ name, value, options });
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[auth middleware] getUser failed:", authError.message);
  }

  const { pathname } = request.nextUrl;

  if (pathname === "/logout") {
    return applySessionCookies(supabaseResponse, sessionCookies);
  }

  if (isPublicRoute(pathname)) {
    if (user && isAuthRoute(pathname)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/dashboard";
      redirectUrl.search = "";
      return applySessionCookies(
        NextResponse.redirect(redirectUrl),
        sessionCookies
      );
    }
    return applySessionCookies(supabaseResponse, sessionCookies);
  }

  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    if (pathname !== "/") {
      redirectUrl.searchParams.set("redirectTo", pathname);
    }
    return applySessionCookies(
      NextResponse.redirect(redirectUrl),
      sessionCookies
    );
  }

  return applySessionCookies(supabaseResponse, sessionCookies);
}
