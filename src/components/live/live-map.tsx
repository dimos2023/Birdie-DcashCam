"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useVehicleLocation } from "@/hooks/use-vehicle-location";
import type { VehicleLocation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getClientGoogleMapsApiKey } from "@/lib/env.client";

interface LiveMapProps {
  vehicleId: string;
  initialLocation?: VehicleLocation | null;
  route?: VehicleLocation[];
  playbackLocation?: VehicleLocation | null;
  className?: string;
  onLocationUpdate?: (location: VehicleLocation) => void;
}

declare global {
  interface Window {
    google?: typeof google;
    initBirdieMap?: () => void;
  }
}

export function LiveMap({
  vehicleId,
  initialLocation = null,
  route = [],
  playbackLocation = null,
  className,
  onLocationUpdate,
}: LiveMapProps) {
  const liveLocation = useVehicleLocation(vehicleId, initialLocation);
  const location = playbackLocation ?? liveLocation;
  const isLive = !playbackLocation && !!liveLocation;

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiKey = getClientGoogleMapsApiKey();

  useEffect(() => {
    if (liveLocation) {
      onLocationUpdate?.(liveLocation);
    }
  }, [liveLocation, onLocationUpdate]);

  useEffect(() => {
    if (!apiKey) {
      setError("Google Maps API key not configured");
      setLoading(false);
      return;
    }

    const initMap = () => {
      if (!mapRef.current || !window.google) return;

      const defaultCenter = { lat: 24.7136, lng: 46.6753 };
      const center = location
        ? { lat: location.latitude, lng: location.longitude }
        : defaultCenter;

      if (!mapInstance.current) {
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: location ? 15 : 6,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#F2F8FC" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#1C3664" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#3B8ECC" }] },
          ],
        });
      }

      setLoading(false);
    };

    if (window.google?.maps) {
      initMap();
      return;
    }

    const scriptId = "google-maps-script";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initBirdieMap`;
      script.async = true;
      script.defer = true;
      window.initBirdieMap = initMap;
      script.onerror = () => {
        setError("Failed to load Google Maps");
        setLoading(false);
      };
      document.head.appendChild(script);
    } else if (window.google?.maps) {
      initMap();
    } else {
      window.initBirdieMap = initMap;
    }

    return () => {
      delete window.initBirdieMap;
    };
  }, [apiKey, location]);

  useEffect(() => {
    if (!mapInstance.current || !window.google) return;

    if (location) {
      const pos = { lat: location.latitude, lng: location.longitude };

      if (!markerRef.current) {
        markerRef.current = new window.google.maps.Marker({
          position: pos,
          map: mapInstance.current,
          title: "Vehicle",
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 6,
            fillColor: "#1C3664",
            fillOpacity: 1,
            strokeColor: "#3B8ECC",
            strokeWeight: 2,
            rotation: location.heading ?? 0,
          },
        });
      } else {
        markerRef.current.setPosition(pos);
        const icon = markerRef.current.getIcon() as google.maps.Symbol;
        if (icon) {
          icon.rotation = location.heading ?? 0;
          markerRef.current.setIcon(icon);
        }
      }

      if (!playbackLocation) {
        mapInstance.current.panTo(pos);
      }
    }

    if (route.length > 1) {
      const path = route.map((h) => ({ lat: h.latitude, lng: h.longitude }));

      if (polylineRef.current) {
        polylineRef.current.setPath(path);
      } else {
        polylineRef.current = new window.google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#3B8ECC",
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map: mapInstance.current,
        });
      }

      if (playbackLocation && route.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        path.forEach((p) => bounds.extend(p));
        mapInstance.current.fitBounds(bounds, 48);
      }
    } else if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
  }, [location, route, playbackLocation]);

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border bg-white shadow-sm",
          className
        )}
      >
        <div className="p-6 text-center">
          <p className="text-sm font-medium text-[#1C3664]">Map unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          {location && (
            <p className="mt-3 font-mono text-xs">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-white shadow-sm", className)}>
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <Badge
          className={cn(
            "shadow-sm",
            isLive
              ? "bg-red-500 text-white hover:bg-red-500"
              : playbackLocation
                ? "bg-[#3B8ECC] text-white hover:bg-[#3B8ECC]"
                : "bg-gray-500 text-white hover:bg-gray-500"
          )}
        >
          {isLive ? (
            <>
              <Radio className="mr-1 h-3 w-3 animate-pulse" />
              LIVE
            </>
          ) : playbackLocation ? (
            "REPLAY"
          ) : (
            "OFFLINE"
          )}
        </Badge>
        {location && (
          <Badge variant="outline" className="border-white/60 bg-white/90 text-[#1C3664]">
            {Math.round(location.speed_kmh ?? 0)} km/h
          </Badge>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F2F8FC]">
          <Loader2 className="h-8 w-8 animate-spin text-[#3B8ECC]" />
        </div>
      )}
      <div ref={mapRef} className="h-full min-h-[360px] w-full md:min-h-[480px]" />
    </div>
  );
}
