"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import type { Gps51WebDeviceLive } from "@/lib/types";
import {
  getDisplayStatus,
  hasValidCoordinates,
  markerColor,
  statusLabel,
} from "@/lib/gps51/fleet-utils";
import { cn } from "@/lib/utils";

interface Gps51FleetMapProps {
  devices: Gps51WebDeviceLive[];
  selectedId: string | null;
  onSelect: (deviceId: string) => void;
  className?: string;
}

type ProjectedMarker = {
  device: Gps51WebDeviceLive;
  x: number;
  y: number;
};

function projectMarkers(devices: Gps51WebDeviceLive[], padding = 6): ProjectedMarker[] {
  const valid = devices.filter(hasValidCoordinates);
  if (valid.length === 0) return [];

  const lats = valid.map((d) => d.latitude!);
  const lngs = valid.map((d) => d.longitude!);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat || 0.01;
  const lngSpan = maxLng - minLng || 0.01;
  const inner = 100 - padding * 2;

  return valid.map((device) => ({
    device,
    x: padding + ((device.longitude! - minLng) / lngSpan) * inner,
    y: padding + (1 - (device.latitude! - minLat) / latSpan) * inner,
  }));
}

function clusterMarkers(markers: ProjectedMarker[], threshold = 2.5): ProjectedMarker[][] {
  const clusters: ProjectedMarker[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < markers.length; i++) {
    if (used.has(i)) continue;
    const cluster = [markers[i]];
    used.add(i);

    for (let j = i + 1; j < markers.length; j++) {
      if (used.has(j)) continue;
      const dx = markers[i].x - markers[j].x;
      const dy = markers[i].y - markers[j].y;
      if (Math.hypot(dx, dy) <= threshold) {
        cluster.push(markers[j]);
        used.add(j);
      }
    }
    clusters.push(cluster);
  }

  return clusters;
}

export function Gps51FleetMap({ devices, selectedId, onSelect, className }: Gps51FleetMapProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);

  const markers = useMemo(() => projectMarkers(devices), [devices]);
  const clusters = useMemo(() => clusterMarkers(markers), [markers]);

  if (markers.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[360px] items-center justify-center rounded-2xl border border-[#e8f2fa] bg-[#F2F8FC] text-sm text-muted-foreground",
          className
        )}
      >
        No devices with valid GPS coordinates match the current filters.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#e8f2fa] bg-white shadow-md",
        className
      )}
    >
      <div className="absolute top-4 left-4 z-10 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-sm">
        <p className="font-medium text-[#1C3664]">Fleet map</p>
        <p className="text-muted-foreground">{markers.length} positioned devices</p>
      </div>

      <div className="relative min-h-[360px] w-full bg-[#F2F8FC] md:min-h-[420px]">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(#d4e4f0 1px, transparent 1px), linear-gradient(90deg, #d4e4f0 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#3B8ECC]/5 via-transparent to-[#1C3664]/5" />

        {clusters.map((cluster, index) => {
          if (cluster.length > 1) {
            const avgX = cluster.reduce((sum, m) => sum + m.x, 0) / cluster.length;
            const avgY = cluster.reduce((sum, m) => sum + m.y, 0) / cluster.length;
            return (
              <button
                key={`cluster-${index}`}
                type="button"
                className="absolute z-10 flex h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#1C3664] px-2 text-xs font-semibold text-white shadow-md"
                style={{ left: `${avgX}%`, top: `${avgY}%` }}
                onClick={() => onSelect(cluster[0].device.gps51_device_id)}
                title={`${cluster.length} devices`}
              >
                {cluster.length}
              </button>
            );
          }

          const marker = cluster[0];
          const status = getDisplayStatus(marker.device);
          const isSelected = selectedId === marker.device.gps51_device_id;
          const isHovered = hoverId === marker.device.gps51_device_id;

          return (
            <div
              key={marker.device.gps51_device_id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            >
              <button
                type="button"
                className={cn(
                  "relative flex h-7 w-7 items-center justify-center rounded-full shadow-md ring-2 ring-white transition-transform",
                  isSelected && "scale-125 ring-[#3B8ECC]"
                )}
                style={{ backgroundColor: markerColor(status) }}
                onClick={() => onSelect(marker.device.gps51_device_id)}
                onMouseEnter={() => setHoverId(marker.device.gps51_device_id)}
                onMouseLeave={() => setHoverId(null)}
                aria-label={marker.device.device_name ?? marker.device.source_device_id}
              >
                <MapPin className="h-3.5 w-3.5 text-white" />
              </button>

              {isHovered && (
                <div className="absolute top-full left-1/2 z-20 mt-2 w-44 -translate-x-1/2 rounded-lg border border-[#e8f2fa] bg-white p-2 text-left text-xs shadow-lg">
                  <p className="truncate font-medium text-[#1C3664]">
                    {marker.device.device_name ?? marker.device.source_device_id}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {marker.device.source_device_id}
                  </p>
                  <p className="mt-1">{statusLabel(status)}</p>
                  <p>
                    {marker.device.speed_kmh != null
                      ? `${marker.device.speed_kmh} km/h`
                      : "Speed —"}
                  </p>
                  <p>
                    ACC:{" "}
                    {marker.device.acc_on == null ? "—" : marker.device.acc_on ? "On" : "Off"}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
