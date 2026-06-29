import "server-only";

import type { Json } from "@/lib/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fieldsToLogSummary,
  hasAnyParsedFields,
  parseGps51LocationRecords,
  parseGps51PayloadFields,
  type ParsedGps51Fields,
} from "@/lib/gps51/parser";

type Gps51DeviceMapping = {
  id: string;
  gps51_device_id: string;
  device_id: string | null;
  vehicle_id: string | null;
  customer_id: string | null;
  display_name: string | null;
  is_active: boolean;
};

export type Gps51WebhookProcessResult = {
  logId: string | null;
  status: string;
  errorMessage: string | null;
  locationsInserted: number;
};

async function findActiveMapping(
  gps51DeviceId: string
): Promise<Gps51DeviceMapping | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("gps51_device_mappings")
    .select("*")
    .eq("gps51_device_id", gps51DeviceId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("GPS51 mapping lookup failed:", error);
    throw new Error(error.message);
  }

  return (data as Gps51DeviceMapping | null) ?? null;
}

async function resolveOrganizationId(
  mapping: Gps51DeviceMapping
): Promise<string | null> {
  const supabase = createAdminClient();

  if (mapping.device_id) {
    const { data } = await supabase
      .from("devices")
      .select("organization_id")
      .eq("id", mapping.device_id)
      .maybeSingle();
    if (data?.organization_id) return data.organization_id;
  }

  if (mapping.vehicle_id) {
    const { data } = await supabase
      .from("vehicles")
      .select("organization_id")
      .eq("id", mapping.vehicle_id)
      .maybeSingle();
    if (data?.organization_id) return data.organization_id;
  }

  return null;
}

async function insertVehicleLocation(
  mapping: Gps51DeviceMapping,
  organizationId: string,
  fields: ParsedGps51Fields
): Promise<void> {
  if (!mapping.vehicle_id || fields.latitude == null || fields.longitude == null) {
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicle_locations").insert({
    organization_id: organizationId,
    vehicle_id: mapping.vehicle_id,
    device_id: mapping.device_id,
    latitude: fields.latitude,
    longitude: fields.longitude,
    speed_kmh: fields.speedKmh,
    recorded_at: fields.recordedAt ?? new Date().toISOString(),
  });

  if (error) {
    console.error("GPS51 vehicle_locations insert failed:", error);
    throw new Error(error.message);
  }
}

async function updateDeviceTelemetry(
  deviceId: string,
  fields: ParsedGps51Fields
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("devices")
    .update({
      last_seen_at: fields.recordedAt ?? new Date().toISOString(),
      last_latitude: fields.latitude,
      last_longitude: fields.longitude,
      last_speed_kmh: fields.speedKmh,
    })
    .eq("id", deviceId);

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("column") && message.includes("does not exist")) {
      console.warn("GPS51 device telemetry columns missing; skipping device update");
      return;
    }
    console.error("GPS51 device telemetry update failed:", error);
    throw new Error(error.message);
  }
}

async function processLocationFields(
  fields: ParsedGps51Fields
): Promise<{ inserted: boolean; warning?: string }> {
  if (!fields.deviceId || fields.latitude == null || fields.longitude == null) {
    return { inserted: false };
  }

  const mapping = await findActiveMapping(fields.deviceId);
  if (!mapping) {
    return {
      inserted: false,
      warning: `No active mapping for GPS51 device ${fields.deviceId}`,
    };
  }

  if (!mapping.vehicle_id) {
    return {
      inserted: false,
      warning: `Mapping for ${fields.deviceId} has no vehicle_id`,
    };
  }

  const organizationId = await resolveOrganizationId(mapping);
  if (!organizationId) {
    return {
      inserted: false,
      warning: `Could not resolve organization for GPS51 device ${fields.deviceId}`,
    };
  }

  await insertVehicleLocation(mapping, organizationId, fields);

  if (mapping.device_id) {
    await updateDeviceTelemetry(mapping.device_id, fields);
  }

  return { inserted: true };
}

export async function processGps51Webhook(
  headers: Record<string, string>,
  payload: unknown
): Promise<Gps51WebhookProcessResult> {
  const supabase = createAdminClient();
  const summaryFields = parseGps51PayloadFields(payload);
  const locationRecords = parseGps51LocationRecords(payload);
  const logSummary = fieldsToLogSummary(summaryFields);

  let status = hasAnyParsedFields(summaryFields) ? "parsed" : "received";
  let errorMessage: string | null = null;
  let locationsInserted = 0;
  const warnings: string[] = [];

  for (const fields of locationRecords) {
    try {
      const result = await processLocationFields(fields);
      if (result.inserted) {
        locationsInserted += 1;
        status = "processed";
      } else if (result.warning) {
        warnings.push(result.warning);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown processing error";
      console.error("GPS51 telemetry processing failed:", error);
      warnings.push(message);
    }
  }

  if (summaryFields.deviceId && locationRecords.length === 0 && hasAnyParsedFields(summaryFields)) {
    warnings.push("Device id found but latitude/longitude were missing");
    status = "partial";
  }

  if (locationsInserted === 0 && warnings.length > 0) {
    status = status === "received" ? "partial" : status;
    errorMessage = warnings.join("; ");
  } else if (locationsInserted > 0 && warnings.length > 0) {
    status = "partial";
    errorMessage = warnings.join("; ");
  }

  const { data: logRow, error: logError } = await supabase
    .from("gps51_webhook_logs")
    .insert({
      headers: headers as Json,
      payload: (payload ?? {}) as Json,
      ...logSummary,
      status,
      error_message: errorMessage,
    })
    .select("id")
    .single();

  if (logError) {
    console.error("GPS51 webhook log insert failed:", logError);
    throw new Error(logError.message);
  }

  return {
    logId: logRow?.id ?? null,
    status,
    errorMessage,
    locationsInserted,
  };
}
