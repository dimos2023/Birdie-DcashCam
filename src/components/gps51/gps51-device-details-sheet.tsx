"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Gps51WebDeviceLive } from "@/lib/types";
import {
  formatCoordinates,
  formatExactTime,
  formatRelativeTime,
  getDisplayStatus,
  getPositionSourceLabel,
  googleMapsUrl,
  hasValidCoordinates,
  statusBadgeClass,
  statusLabel,
} from "@/lib/gps51/fleet-utils";
import { cn } from "@/lib/utils";

interface Gps51DeviceDetailsSheetProps {
  device: Gps51WebDeviceLive | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-[#e8f2fa] py-2 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-[#1C3664]">{value}</dd>
    </div>
  );
}

export function Gps51DeviceDetailsSheet({
  device,
  open,
  onOpenChange,
}: Gps51DeviceDetailsSheetProps) {
  if (!device) return null;

  const displayStatus = getDisplayStatus(device);
  const hasCoords = hasValidCoordinates(device);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-[#1C3664]">{device.device_name ?? device.source_device_id}</SheetTitle>
          <SheetDescription>GPS51 synchronized device details</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-1">
          <DetailRow label="Device Name" value={device.device_name ?? "—"} />
          <DetailRow label="Device ID" value={<span className="font-mono">{device.source_device_id}</span>} />
          <DetailRow label="SIM Number" value={device.sim_no ?? "—"} />
          <DetailRow label="Group Path" value={device.group_path ?? "—"} />
          <DetailRow
            label="Current Status"
            value={
              <Badge variant="outline" className={cn("border", statusBadgeClass(displayStatus))}>
                {statusLabel(displayStatus)}
              </Badge>
            }
          />
          <DetailRow
            label="Last Seen"
            value={
              <>
                {formatRelativeTime(device.last_seen_at)}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatExactTime(device.last_seen_at)}
                </span>
              </>
            }
          />
          <DetailRow
            label="Latitude"
            value={device.latitude != null ? device.latitude.toFixed(6) : "—"}
          />
          <DetailRow
            label="Longitude"
            value={device.longitude != null ? device.longitude.toFixed(6) : "—"}
          />
          <DetailRow
            label="Speed"
            value={device.speed_kmh != null ? `${device.speed_kmh} km/h` : "—"}
          />
          <DetailRow
            label="ACC"
            value={device.acc_on == null ? "—" : device.acc_on ? "On" : "Off"}
          />
          <DetailRow
            label="Moving"
            value={device.moving == null ? "—" : device.moving ? "Yes" : "No"}
          />
          <DetailRow
            label="Positioned"
            value={device.positioned == null ? "—" : device.positioned ? "Yes" : "No"}
          />
          <DetailRow
            label="Direction"
            value={device.direction_deg != null ? `${device.direction_deg}°` : "—"}
          />
          <DetailRow
            label="Altitude"
            value={device.altitude_m != null ? `${device.altitude_m} m` : "—"}
          />
          <DetailRow
            label="Signal"
            value={
              device.cellular_signal_percent != null
                ? `${device.cellular_signal_percent}%`
                : "—"
            }
          />
          <DetailRow label="Satellites" value={device.satellite_count ?? "—"} />
          <DetailRow
            label="Source Update"
            value={
              <>
                {formatRelativeTime(device.source_updated_at)}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatExactTime(device.source_updated_at)}
                </span>
              </>
            }
          />
          <DetailRow
            label="GPS Location Time"
            value={
              <>
                {formatRelativeTime(device.source_located_at ?? device.received_at)}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatExactTime(device.source_located_at ?? device.received_at)}
                </span>
              </>
            }
          />
          <DetailRow
            label="Received Time"
            value={
              <>
                {formatRelativeTime(device.received_at)}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {formatExactTime(device.received_at)}
                </span>
              </>
            }
          />
          <DetailRow label="Source" value={<Badge variant="secondary">{getPositionSourceLabel(device)}</Badge>} />
        </div>

        {hasCoords && (
          <div className="mt-6 space-y-2">
            <p className="text-sm font-medium text-[#1C3664]">Coordinates</p>
            <p className="font-mono text-xs text-muted-foreground">
              {formatCoordinates(device.latitude, device.longitude)}
            </p>
            <a
              href={googleMapsUrl(device.latitude!, device.longitude!)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ className: "bg-[#3B8ECC] hover:bg-[#3B8ECC]/90" })}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Google Maps
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
