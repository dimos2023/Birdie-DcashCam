import type { DeviceStatus } from "@/lib/types";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function statusAfterVehicleAssignment(submittedStatus: DeviceStatus): DeviceStatus {
  return submittedStatus === "active" ? submittedStatus : "active";
}

export async function syncDeviceVehicleAssignment(
  supabase: SupabaseServerClient,
  deviceId: string,
  vehicleId: string | null,
  submittedStatus: DeviceStatus
): Promise<{ error?: string }> {
  if (!vehicleId) {
    const { error } = await supabase
      .from("vehicle_devices")
      .update({ is_active: false })
      .eq("device_id", deviceId)
      .eq("is_active", true);

    if (error) {
      console.error("Deactivate vehicle_devices failed:", error);
      return { error: error.message };
    }

    return {};
  }

  const { error: deactivateError } = await supabase
    .from("vehicle_devices")
    .update({ is_active: false })
    .eq("device_id", deviceId)
    .eq("is_active", true);

  if (deactivateError) {
    console.error("Deactivate vehicle_devices failed:", deactivateError);
    return { error: deactivateError.message };
  }

  const { error: insertError } = await supabase.from("vehicle_devices").insert({
    vehicle_id: vehicleId,
    device_id: deviceId,
    is_active: true,
    assigned_at: new Date().toISOString(),
  });

  if (insertError) {
    console.error("Insert vehicle_devices failed:", insertError);
    return { error: insertError.message };
  }

  const newStatus = statusAfterVehicleAssignment(submittedStatus);
  const { error: statusError } = await supabase
    .from("devices")
    .update({ status: newStatus })
    .eq("id", deviceId);

  if (statusError) {
    console.error("Update device status after assignment failed:", statusError);
    return { error: statusError.message };
  }

  return {};
}
