import { NextResponse } from "next/server";
import type { Json } from "@/lib/types";
import {
  getGps51WebhookSecret,
  headersToJson,
  logGps51AuthDebug,
  stripSecretFromPayload,
  validateGps51WebhookAuth,
} from "@/lib/gps51/auth";
import {
  hasAnyParsedFields,
  parseGps51PayloadFields,
} from "@/lib/gps51/parser";
import { processGps51Telemetry } from "@/lib/gps51/process-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function toJsonPayload(payload: unknown): Json {
  try {
    return JSON.parse(JSON.stringify(payload ?? {})) as Json;
  } catch {
    return { raw: String(payload ?? "") };
  }
}

async function parseRequestBody(request: Request): Promise<unknown> {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return await request.json();
    }

    const text = await request.text();
    if (!text.trim()) return {};

    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  } catch (error) {
    console.error("GPS51 webhook body parse failed:", error);
    return { parse_error: "Invalid JSON body" };
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "GPS51 webhook is online",
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const expectedSecret = getGps51WebhookSecret();

  if (!expectedSecret) {
    console.error("GPS51 webhook: GPS51_WEBHOOK_SECRET is not configured");
    logGps51AuthDebug(
      {
        expectedSecretConfigured: false,
        expectedSecretLength: 0,
        providedSecretLength: 0,
        source: null,
      },
      false
    );
    return NextResponse.json(
      { success: false, error: "Webhook secret is not configured" },
      { status: 503 }
    );
  }

  const rawPayload = await parseRequestBody(request);
  const auth = validateGps51WebhookAuth(request, url, rawPayload);
  logGps51AuthDebug(auth.debug, auth.authorized);

  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = stripSecretFromPayload(rawPayload);
  const headers = headersToJson(request);

  console.log("GPS51 webhook received:", JSON.stringify({ headers, payload }));

  const summaryFields = parseGps51PayloadFields(payload);
  let status = hasAnyParsedFields(summaryFields) ? "parsed" : "received";
  let errorMessage: string | null = null;

  try {
    const telemetryResult = await processGps51Telemetry(payload);
    status = telemetryResult.status;
    errorMessage = telemetryResult.errorMessage;
  } catch (error) {
    console.error("GPS51 telemetry processing failed:", error);
    errorMessage = error instanceof Error ? error.message : "Telemetry processing failed";
    status = "partial";
  }

  const supabase = createAdminClient();
  const { data: logRow, error: insertError } = await supabase
    .from("gps51_webhook_logs")
    .insert({
      headers: headers as Json,
      payload: toJsonPayload(payload),
      parsed_device_id: summaryFields.deviceId,
      parsed_latitude: summaryFields.latitude,
      parsed_longitude: summaryFields.longitude,
      parsed_speed_kmh: summaryFields.speedKmh,
      status,
      error_message: errorMessage,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("GPS51 webhook log insert failed:", {
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
      code: insertError.code,
    });
    return NextResponse.json(
      { success: false, error: insertError.message },
      { status: 500 }
    );
  }

  if (!logRow?.id) {
    console.error("GPS51 webhook log insert returned no row:", logRow);
    return NextResponse.json(
      { success: false, error: "Webhook log was not saved to database" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, logId: logRow.id });
}
