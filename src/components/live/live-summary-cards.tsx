import { format } from "date-fns";
import { Building2, Cpu, MapPin, Radio, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VehicleLocation } from "@/lib/types";

interface LiveSummaryCardsProps {
  customerName?: string | null;
  plateNumber: string;
  deviceSerial?: string | null;
  status: string;
  lastLocation?: VehicleLocation | null;
}

export function LiveSummaryCards({
  customerName,
  plateNumber,
  deviceSerial,
  status,
  lastLocation,
}: LiveSummaryCardsProps) {
  const isActive = status === "active";

  const cards = [
    {
      label: "Customer",
      value: customerName ?? "Unassigned",
      icon: Building2,
      sub: customerName ? "Fleet account" : "No customer linked",
    },
    {
      label: "Plate Number",
      value: plateNumber,
      icon: MapPin,
      sub: "Registered vehicle",
    },
    {
      label: "Device Serial",
      value: deviceSerial ?? "—",
      icon: Cpu,
      sub: deviceSerial ? "Primary device" : "No device assigned",
    },
    {
      label: "Status",
      value: status,
      icon: Radio,
      sub: isActive ? "Online monitoring" : "Monitoring paused",
      badge: true,
    },
    {
      label: "Last Update",
      value: lastLocation
        ? format(new Date(lastLocation.recorded_at), "dd MMM yyyy, HH:mm:ss")
        : "—",
      icon: Clock,
      sub: lastLocation
        ? `${Math.round(lastLocation.speed_kmh ?? 0)} km/h · ${lastLocation.ignition_on ? "Ignition on" : "Ignition off"}`
        : "Waiting for GPS signal",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label} className="border-0 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-[#1C3664]/10 p-2">
              <card.icon className="h-4 w-4 text-[#1C3664]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
              {card.badge ? (
                <Badge
                  className={cn(
                    "mt-1 capitalize",
                    isActive
                      ? "bg-green-100 text-green-800 hover:bg-green-100"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {card.value}
                </Badge>
              ) : (
                <p className="mt-0.5 truncate text-sm font-semibold text-[#1C3664]">
                  {card.value}
                </p>
              )}
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.sub}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
