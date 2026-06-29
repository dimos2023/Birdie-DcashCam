"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { VehicleLocation } from "@/lib/types";

export function useVehicleLocation(vehicleId: string, initial?: VehicleLocation | null) {
  const [location, setLocation] = useState<VehicleLocation | null>(initial ?? null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`vehicle-location-${vehicleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vehicle_locations",
          filter: `vehicle_id=eq.${vehicleId}`,
        },
        (payload) => {
          setLocation(payload.new as VehicleLocation);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vehicleId]);

  return location;
}
