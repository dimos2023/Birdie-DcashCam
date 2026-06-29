import { NextResponse } from "next/server";
import type { Json } from "@/lib/types";
import {
  getGps51WebhookSecret,
  headersToJson,
  validateGps51WebhookSecret,
} from "@/lib/gps51/auth";
import { processGps51Webhook } from "@/lib/gps51/process-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = new URL(request.url);

  if (!getGps51WebhookSecret()) {
    console.error("GPS51 webhook: GPS51_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { success: false, error: "Webhook secret is not configured" },
      { status: 503 }
    );
  }

  if (!validateGps51WebhookSecret(request, url)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown = null;
  const headers = headersToJson(request);

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else {
      const text = await request.text();
      if (text.trim()) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = { raw: text };
        }
      } else {
        payload = {};
      }
    }
  } catch (error) {
    console.error("GPS51 webhook body parse failed:", error);
    payload = { parse_error: "Invalid JSON body" };
  }

  console.log("GPS51 webhook received:", JSON.stringify({ headers, payload }));

  try {
    await processGps51Webhook(headers, payload);
  } catch (error) {
    console.error("GPS51 webhook processing failed:", error);

    try {
      const supabase = createAdminClient();
      await supabase.from("gps51_webhook_logs").insert({
        headers: headers as Json,
        payload: (payload ?? {}) as Json,
        status: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
      });
    } catch (logError) {
      console.error("GPS51 failed to write error log:", logError);
    }
  }

  return NextResponse.json({ success: true });
}
