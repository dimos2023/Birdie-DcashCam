import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = getServerEnv().WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const body = await request.json();

  // Process incoming messages via createAdminClient() in production
  console.log("WhatsApp webhook received:", JSON.stringify(body).slice(0, 200));

  return NextResponse.json({ status: "ok" });
}
