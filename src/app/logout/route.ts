import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function signOutAndRedirect(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/login`);
}

/** Signs the user out and redirects to the login page. */
export async function POST(request: Request) {
  return signOutAndRedirect(request);
}

/** Allow GET logout for link navigation from the sidebar and topbar. */
export async function GET(request: Request) {
  return signOutAndRedirect(request);
}
