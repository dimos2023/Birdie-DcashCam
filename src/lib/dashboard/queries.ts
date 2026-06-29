import { createClient } from "@/lib/supabase/server";

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getDashboardData() {
  const supabase = await createClient();
  const todayIso = startOfTodayIso();

  const [
    totalDevicesRes,
    assignedDevicesRes,
    activeVehiclesRes,
    inactiveVehiclesRes,
    maintenanceVehiclesRes,
    customersRes,
    gpsTodayRes,
    latestVehiclesRes,
    latestDevicesRes,
    recentLocationsRes,
    allVehiclesRes,
    todayLocationVehiclesRes,
    activeDevicesRes,
  ] = await Promise.all([
    supabase.from("devices").select("*", { count: "exact", head: true }),
    supabase
      .from("vehicle_devices")
      .select("device_id", { count: "exact", head: true })
      .is("unassigned_at", null),
    supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true })
      .eq("status", "inactive"),
    supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true })
      .eq("status", "maintenance"),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("vehicle_locations")
      .select("*", { count: "exact", head: true })
      .gte("recorded_at", todayIso),
    supabase
      .from("vehicles")
      .select("id, plate_number, make, model, status, created_at, customers(name)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("devices")
      .select("id, serial_number, status, last_seen_at, created_at, device_models(name, type)")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("vehicle_locations")
      .select(
        "id, latitude, longitude, speed_kmh, ignition_on, recorded_at, vehicles(plate_number)"
      )
      .order("recorded_at", { ascending: false })
      .limit(8),
    supabase.from("vehicles").select("id, status"),
    supabase
      .from("vehicle_locations")
      .select("vehicle_id")
      .gte("recorded_at", todayIso),
    supabase
      .from("devices")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const totalDevices = totalDevicesRes.count ?? 0;
  const assignedDevices = assignedDevicesRes.count ?? 0;
  const activeVehicles = activeVehiclesRes.count ?? 0;
  const inactiveVehicles = inactiveVehiclesRes.count ?? 0;
  const maintenanceVehicles = maintenanceVehiclesRes.count ?? 0;
  const customers = customersRes.count ?? 0;
  const gpsSignalsToday = gpsTodayRes.count ?? 0;
  const activeDevices = activeDevicesRes.count ?? 0;

  const vehiclesWithSignalToday = new Set(
    (todayLocationVehiclesRes.data ?? []).map((row) => row.vehicle_id)
  );

  const activeWithoutSignal = (allVehiclesRes.data ?? []).filter(
    (v) => v.status === "active" && !vehiclesWithSignalToday.has(v.id)
  ).length;

  const offlineVehicles =
    inactiveVehicles + maintenanceVehicles + activeWithoutSignal;

  const totalVehicles = allVehiclesRes.data?.length ?? 0;
  const unassignedDevices = Math.max(0, totalDevices - assignedDevices);

  const assignmentRate =
    totalDevices > 0 ? Math.round((assignedDevices / totalDevices) * 100) : 0;
  const deviceOnlineRate =
    totalDevices > 0 ? Math.round((activeDevices / totalDevices) * 100) : 0;
  const gpsCoverageRate =
    activeVehicles > 0
      ? Math.round(
          ((activeVehicles - activeWithoutSignal) / activeVehicles) * 100
        )
      : 0;

  return {
    stats: {
      totalDevices,
      assignedDevices,
      unassignedDevices,
      activeVehicles,
      offlineVehicles,
      customers,
      gpsSignalsToday,
      totalVehicles,
      activeDevices,
    },
    health: {
      assignmentRate,
      deviceOnlineRate,
      gpsCoverageRate,
      fleetActiveRate:
        totalVehicles > 0
          ? Math.round((activeVehicles / totalVehicles) * 100)
          : 0,
    },
    latestVehicles: latestVehiclesRes.data ?? [],
    latestDevices: latestDevicesRes.data ?? [],
    recentLocations: recentLocationsRes.data ?? [],
  };
}
