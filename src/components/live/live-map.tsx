"use client";

import { useMemo } from "react";
import { MapPin, Navigation, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VehicleLocation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LiveMapProps {
  location: VehicleLocation | null;
  route?: VehicleLocation[];
  playbackLocation?: VehicleLocation | null;
  className?: string;
  isDemo?: boolean;
}

/** Normalizes lat/lng to 0–100 SVG viewBox coordinates for demo map. */
function projectPoints(
  points: VehicleLocation[],
  padding = 8
): Array<{ x: number; y: number }> {
  if (points.length === 0) return [];

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latSpan = maxLat - minLat || 0.01;
  const lngSpan = maxLng - minLng || 0.01;
  const inner = 100 - padding * 2;

  return points.map((p) => ({
    x: padding + ((p.longitude - minLng) / lngSpan) * inner,
    y: padding + (1 - (p.latitude - minLat) / latSpan) * inner,
  }));
}

export function LiveMap({
  location,
  route = [],
  playbackLocation = null,
  className,
  isDemo = false,
}: LiveMapProps) {
  const activeLocation = playbackLocation ?? location;
  const isReplay = !!playbackLocation;
  const isLive = !playbackLocation && !!location;

  const routePoints = route.length > 0 ? route : location ? [location] : [];
  const projected = useMemo(() => projectPoints(routePoints), [routePoints]);
  const markerProjected = useMemo(() => {
    if (!activeLocation) return null;
    const pts = projectPoints(routePoints.length > 0 ? routePoints : [activeLocation]);
    return pts[pts.length - 1] ?? projectPoints([activeLocation])[0];
  }, [activeLocation, routePoints]);

  const polylinePoints = projected.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[#e8f2fa] bg-white shadow-md",
        className
      )}
    >
      {/* Map chrome */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        <Badge
          className={cn(
            "shadow-sm",
            isLive
              ? "bg-red-500 text-white hover:bg-red-500"
              : isReplay
                ? "bg-[#3B8ECC] text-white hover:bg-[#3B8ECC]"
                : "bg-gray-500 text-white hover:bg-gray-500"
          )}
        >
          {isLive ? (
            <>
              <Radio className="mr-1 h-3 w-3 animate-pulse" />
              LIVE
            </>
          ) : isReplay ? (
            "REPLAY"
          ) : (
            "OFFLINE"
          )}
        </Badge>
        {activeLocation && (
          <Badge variant="outline" className="border-white/60 bg-white/90 text-[#1C3664]">
            {Math.round(activeLocation.speed_kmh ?? 0)} km/h
          </Badge>
        )}
        {isDemo && (
          <Badge variant="outline" className="border-[#3B8ECC]/30 bg-white/90 text-[#3B8ECC]">
            Placeholder GPS
          </Badge>
        )}
      </div>

      <div className="absolute top-4 right-4 z-10 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-1.5 font-medium text-[#1C3664]">
          <Navigation className="h-3.5 w-3.5 text-[#3B8ECC]" />
          Birdie Maps
        </div>
        {activeLocation && (
          <p className="mt-1 font-mono text-[10px] text-[#1C1C1C]/55">
            {activeLocation.latitude.toFixed(5)}, {activeLocation.longitude.toFixed(5)}
          </p>
        )}
      </div>

      {/* Map canvas */}
      <div className="relative h-full min-h-[380px] w-full bg-[#F2F8FC] md:min-h-[480px]">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(#d4e4f0 1px, transparent 1px), linear-gradient(90deg, #d4e4f0 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#3B8ECC]/5 via-transparent to-[#1C3664]/5" />

        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          {projected.length > 1 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#3B8ECC"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.85"
            />
          )}
          {projected.length > 1 && (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#1C3664"
              strokeWidth="0.4"
              strokeDasharray="2 2"
              strokeOpacity="0.3"
            />
          )}
        </svg>

        {markerProjected && (
          <div
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
            style={{
              left: `${markerProjected.x}%`,
              top: `${markerProjected.y}%`,
            }}
          >
            <div className="relative">
              <span className="absolute inline-flex h-10 w-10 animate-ping rounded-full bg-[#3B8ECC]/30" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#1C3664] shadow-lg ring-4 ring-white">
                <MapPin className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
        )}

        {!activeLocation && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-[#1C1C1C]/45">No GPS signal available</p>
          </div>
        )}
      </div>
    </div>
  );
}
