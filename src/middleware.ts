import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

const PUBLIC_ROUTES = new Set(["/login"]);
const PUBLIC_PREFIXES = ["/auth/callback", "/api/webhooks"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname) || pathname === "/logout") {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Copy refreshed Supabase session cookies onto any middleware response. */
function withSessionCookies(
  source: NextResponse,
  target: NextResponse
): NextResponse {
  source.cookies.getAll().forEach(({ name, value, ...options }) => {
    target.cookies.set(name, value, options);
  });
  return target;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  let supabaseUrl: string;
  let anonKey: string;

  try {
    ({ url: supabaseUrl, anonKey } = getPublicSupabaseConfig());
  } catch (error) {
    console.error("[auth middleware] Supabase config missing:", error);
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
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

  if (isPublicPath(pathname)) {
    if (user && pathname === "/login") {
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

  if (!user) {
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
