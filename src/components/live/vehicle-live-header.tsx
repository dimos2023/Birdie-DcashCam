import { format } from "date-fns";
import { Building2, Clock, Cpu, MapPin, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VehicleLocation } from "@/lib/types";

interface VehicleLiveHeaderProps {
  customerName?: string | null;
  plateNumber: string;
  deviceSerial?: string | null;
  status: string;
  lastLocation?: VehicleLocation | null;
  isDemo?: boolean;
}

export function VehicleLiveHeader({
  customerName,
  plateNumber,
  deviceSerial,
  status,
  lastLocation,
  isDemo = false,
}: VehicleLiveHeaderProps) {
  const isActive = status === "active";

  const items = [
    {
      icon: Building2,
      label: "Customer",
      value: customerName ?? "Unassigned",
      sub: customerName ? "Fleet account" : "No customer linked",
    },
    {
      icon: MapPin,
      label: "Plate Number",
      value: plateNumber,
      sub: "Registered vehicle",
    },
    {
      icon: Cpu,
      label: "Device Serial",
      value: deviceSerial ?? "—",
      sub: deviceSerial ? "Primary device" : "No device assigned",
    },
    {
      icon: Radio,
      label: "Vehicle Status",
      value: status,
      sub: isActive ? "Monitoring active" : "Monitoring paused",
      badge: true,
    },
    {
      icon: Clock,
      label: "Last Update",
      value: lastLocation
        ? format(new Date(lastLocation.recorded_at), "dd MMM yyyy, HH:mm:ss")
        : "—",
      sub: lastLocation
        ? `${Math.round(lastLocation.speed_kmh ?? 0)} km/h · ${lastLocation.ignition_on ? "Ignition on" : "Ignition off"}`
        : "Waiting for GPS signal",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight text-[#1C3664] md:text-xl">
          Live Monitoring
        </h2>
        <Badge className="bg-red-500 text-white hover:bg-red-500">
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
          LIVE
        </Badge>
        {isDemo && (
          <Badge variant="outline" className="border-[#3B8ECC]/40 text-[#3B8ECC]">
            Demo data
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-3 rounded-xl border border-[#e8f2fa] bg-white p-4 shadow-sm"
          >
            <div className="rounded-lg bg-[#1C3664]/8 p-2.5">
              <item.icon className="h-4 w-4 text-[#1C3664]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[#1C1C1C]/45">
                {item.label}
              </p>
              {item.badge ? (
                <Badge
                  className={cn(
                    "mt-1.5 capitalize",
                    isActive
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {item.value}
                </Badge>
              ) : (
                <p className="mt-1 truncate text-sm font-semibold text-[#1C3664]">
                  {item.value}
                </p>
              )}
              <p className="mt-0.5 truncate text-xs text-[#1C1C1C]/50">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
