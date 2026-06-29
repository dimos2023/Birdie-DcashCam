"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SignInState = {
  error?: string;
};

function safeRedirectPath(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }
  if (path === "/login" || path.startsWith("/auth/")) {
    return "/dashboard";
  }
  return path;
}

/**
 * Sign in via Server Action — persists session in HTTP-only cookies
 * through createServerClient (@supabase/ssr). Never use browser-only login.
 */
export async function signIn(
  _prevState: SignInState | null,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectPath(
    (formData.get("redirectTo") as string | null) ?? null
  );

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const cookieStore = await cookies();
  const supabase = createServerSupabaseClient(cookieStore);

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error("[auth] signIn failed:", error.message);
    return { error: error.message };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error(
      "[auth] signIn session not persisted:",
      userError?.message ?? "no user after signIn"
    );
    return { error: "Session could not be established. Please try again." };
  }

  const hasAuthCookie = cookieStore
    .getAll()
    .some((cookie) => cookie.name.includes("-auth-token"));

  if (!hasAuthCookie) {
    console.error("[auth] signIn session not persisted: auth cookie missing after signIn");
    return { error: "Session could not be established. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo);
}
