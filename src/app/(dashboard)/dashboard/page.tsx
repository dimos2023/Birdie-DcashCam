import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  Car,
  Cpu,
  Link2,
  MapPin,
  Radio,
  Signal,
  SignalZero,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { getCurrentProfile } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

type VehicleRow = {
  id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  status: string;
  created_at: string;
  customers: { name: string } | null;
};

type DeviceRow = {
  id: string;
  serial_number: string;
  status: string;
  last_seen_at: string | null;
  created_at: string;
  device_models: { name: string; type: string } | null;
};

type LocationRow = {
  id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  ignition_on: boolean | null;
  recorded_at: string;
  vehicles: { plate_number: string } | null;
};

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "active") return "default";
  if (status === "maintenance") return "secondary";
  if (status === "inactive") return "outline";
  return "outline";
}

function HealthItem({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "good" | "warn" | "neutral";
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#e8f2fa] bg-[#F2F8FC]/60 px-4 py-3">
      <span className="text-sm text-[#1C1C1C]/70">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold",
          status === "good" && "text-emerald-600",
          status === "warn" && "text-amber-600",
          status === "neutral" && "text-[#1C3664]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function healthStatus(rate: number): "good" | "warn" | "neutral" {
  if (rate >= 80) return "good";
  if (rate >= 50) return "neutral";
  return "warn";
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const { stats, health, latestVehicles, latestDevices, recentLocations } =
    await getDashboardData();

  const hasFleetData =
    stats.totalDevices > 0 ||
    stats.totalVehicles > 0 ||
    stats.customers > 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${profile.full_name}. Here is your fleet overview.`}
      >
        <LinkButton
          href="/live-monitoring"
          size="sm"
          className="bg-[#1C3664] hover:bg-[#1C3664]/90"
        >
          <Radio className="mr-1.5 h-4 w-4" />
          Live Monitoring
        </LinkButton>
      </PageHeader>

      <div className="space-y-6 p-4 md:p-6">
        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <StatCard
            title="Total Devices"
            value={stats.totalDevices}
            icon={Cpu}
            description="Registered hardware"
          />
          <StatCard
            title="Assigned Devices"
            value={stats.assignedDevices}
            icon={Link2}
            description={
              stats.unassignedDevices > 0
                ? `${stats.unassignedDevices} unassigned`
                : "All devices assigned"
            }
            trend={stats.totalDevices > 0 ? `${health.assignmentRate}%` : undefined}
          />
          <StatCard
            title="Active Vehicles"
            value={stats.activeVehicles}
            icon={Car}
            description="Currently active fleet"
          />
          <StatCard
            title="Offline Vehicles"
            value={stats.offlineVehicles}
            icon={WifiOff}
            description="No signal or inactive"
          />
          <StatCard
            title="Customers"
            value={stats.customers}
            icon={Users}
            description="Active accounts"
          />
          <StatCard
            title="GPS Signals Today"
            value={stats.gpsSignalsToday}
            icon={MapPin}
            description="Location pings today"
            trend={stats.activeVehicles > 0 ? `${health.gpsCoverageRate}%` : undefined}
          />
        </div>

        {!hasFleetData && (
          <EmptyState
            icon={Activity}
            title="Your fleet dashboard is ready"
            description="Add customers, vehicles, and devices to start monitoring your fleet in real time."
            actionLabel="Add your first customer"
            actionHref="/customers/new"
            className="py-14"
          />
        )}

        {/* Data sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          <DashboardSection title="Latest Vehicles" viewAllHref="/vehicles">
            {latestVehicles.length === 0 ? (
              <EmptyState
                icon={Car}
                title="No vehicles yet"
                description="Register fleet vehicles to track GPS, cameras, and customer assignments."
                actionLabel="Add vehicle"
                actionHref="/vehicles/new"
              />
            ) : (
              <div className="space-y-2">
                {(latestVehicles as VehicleRow[]).map((vehicle) => (
                  <Link
                    key={vehicle.id}
                    href={`/vehicles/${vehicle.id}`}
                    className="flex items-center justify-between rounded-xl border border-[#e8f2fa] p-3 transition-colors hover:border-[#3B8ECC]/30 hover:bg-[#F2F8FC]"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1C3664]">
                        {vehicle.plate_number}
                      </p>
                      <p className="truncate text-xs text-[#1C1C1C]/50">
                        {[vehicle.make, vehicle.model]
                          .filter(Boolean)
                          .join(" ") || "—"}{" "}
                        · {vehicle.customers?.name ?? "No customer"}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant(vehicle.status)}>
                      {vehicle.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </DashboardSection>

          <DashboardSection title="Latest Devices" viewAllHref="/devices">
            {latestDevices.length === 0 ? (
              <EmptyState
                icon={Cpu}
                title="No devices registered"
                description="Add Birdie dash cams and GPS trackers to assign them to your vehicles."
                actionLabel="Register device"
                actionHref="/devices/new"
              />
            ) : (
              <div className="space-y-2">
                {(latestDevices as DeviceRow[]).map((device) => (
                  <Link
                    key={device.id}
                    href="/devices"
                    className="flex items-center justify-between rounded-xl border border-[#e8f2fa] p-3 transition-colors hover:border-[#3B8ECC]/30 hover:bg-[#F2F8FC]"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1C3664]">
                        {device.serial_number}
                      </p>
                      <p className="truncate text-xs text-[#1C1C1C]/50">
                        {device.device_models?.name ?? "Unknown model"}
                        {device.device_models?.type
                          ? ` · ${device.device_models.type.replace("_", " ")}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant(device.status)}>
                      {device.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </DashboardSection>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <DashboardSection
            title="Recent Location Updates"
            viewAllHref="/live-monitoring"
            viewAllLabel="Live map"
            className="lg:col-span-2"
          >
            {recentLocations.length === 0 ? (
              <EmptyState
                icon={SignalZero}
                title="No GPS data yet"
                description="Location updates will appear here once devices start reporting coordinates."
                actionLabel="View live monitoring"
                actionHref="/live-monitoring"
              />
            ) : (
              <div className="space-y-2">
                {(recentLocations as LocationRow[]).map((loc) => (
                  <div
                    key={loc.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#e8f2fa] px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#3B8ECC]/10">
                        <MapPin className="h-4 w-4 text-[#3B8ECC]" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[#1C3664]">
                          {loc.vehicles?.plate_number ?? "Unknown vehicle"}
                        </p>
                        <p className="truncate text-xs text-[#1C1C1C]/50">
                          {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                          {loc.speed_kmh != null
                            ? ` · ${Math.round(loc.speed_kmh)} km/h`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-[#1C3664]">
                        {formatDistanceToNow(new Date(loc.recorded_at), {
                          addSuffix: true,
                        })}
                      </p>
                      <p className="text-[10px] text-[#1C1C1C]/40">
                        {format(new Date(loc.recorded_at), "HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>

          <DashboardSection title="System Health">
            <div className="space-y-2">
              <HealthItem
                label="Database connection"
                value="Connected"
                status="good"
              />
              <HealthItem
                label="Device online rate"
                value={`${health.deviceOnlineRate}%`}
                status={healthStatus(health.deviceOnlineRate)}
              />
              <HealthItem
                label="Device assignment"
                value={`${health.assignmentRate}%`}
                status={healthStatus(health.assignmentRate)}
              />
              <HealthItem
                label="GPS coverage today"
                value={`${health.gpsCoverageRate}%`}
                status={healthStatus(health.gpsCoverageRate)}
              />
              <HealthItem
                label="Active fleet rate"
                value={`${health.fleetActiveRate}%`}
                status={healthStatus(health.fleetActiveRate)}
              />

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#1C3664]/5 px-4 py-3">
                <Wifi className="h-4 w-4 shrink-0 text-[#3B8ECC]" />
                <p className="text-xs leading-relaxed text-[#1C1C1C]/60">
                  {stats.activeDevices} of {stats.totalDevices} devices online ·{" "}
                  {stats.gpsSignalsToday} GPS pings today
                </p>
              </div>
            </div>
          </DashboardSection>
        </div>
      </div>
    </>
  );
}
