import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

/** Routes accessible without a session */
export const PUBLIC_ROUTES = ["/login"] as const;

/** Route prefixes accessible without a session */
export const PUBLIC_PREFIXES = ["/auth/callback", "/api/webhooks"] as const;

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname as (typeof PUBLIC_ROUTES)[number])) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isAuthRoute(pathname: string): boolean {
  return pathname === "/login";
}

/** Copy refreshed session cookies onto redirect responses. */
function withSessionCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach(({ name, value }) => {
    target.cookies.set(name, value);
  });
  return target;
}

/**
 * Refreshes the Supabase session and enforces route protection.
 * - Unauthenticated users → /login (with redirectTo preserved)
 * - Authenticated users on /login → /dashboard
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

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
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
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
    return supabaseResponse;
  }

  if (!user && !isPublicRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    if (pathname !== "/") {
      redirectUrl.searchParams.set("redirectTo", pathname);
    }
    return withSessionCookies(
      supabaseResponse,
      NextResponse.redirect(redirectUrl)
    );
  }

  if (user && isAuthRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return withSessionCookies(
      supabaseResponse,
      NextResponse.redirect(redirectUrl)
    );
  }

  return supabaseResponse;
}
