"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign in via Server Action — persists session in HTTP-only cookies
 * through the shared server Supabase client (@supabase/ssr).
 */
export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

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

  redirect("/dashboard");
}
