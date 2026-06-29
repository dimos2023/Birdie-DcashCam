"use client";

import { useCallback, useMemo, useState } from "react";
import { VehicleLiveHeader } from "@/components/live/vehicle-live-header";
import { LiveMap } from "@/components/live/live-map";
import { CameraGrid } from "@/components/live/camera-grid";
import { WhatsappChatBox } from "@/components/live/whatsapp-chat-box";
import { LocationHistory } from "@/components/live/location-history";
import type { Vehicle, VehicleLocation, WhatsappMessage } from "@/lib/types";
import type { Trip } from "@/lib/live/trips";

type DeviceType = "dash_cam" | "gps_tracker" | "combo" | null;

interface LiveVehicleViewProps {
  vehicle: Vehicle;
  history: VehicleLocation[];
  currentLocation: VehicleLocation | null;
  messages: WhatsappMessage[];
  customerName?: string | null;
  customerPhone?: string | null;
  deviceSerial?: string | null;
  deviceType?: DeviceType;
  isDemo?: boolean;
}

export function LiveVehicleView({
  vehicle,
  history,
  currentLocation,
  messages,
  customerName,
  customerPhone,
  deviceSerial,
  deviceType,
  isDemo = false,
}: LiveVehicleViewProps) {
  const [playbackLocation, setPlaybackLocation] = useState<VehicleLocation | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const route = useMemo(
    () => selectedTrip?.points ?? history,
    [selectedTrip, history]
  );

  const lastUpdate = playbackLocation ?? currentLocation;

  const handleTripSelect = useCallback((trip: Trip | null) => {
    setSelectedTrip(trip);
    if (!trip) setPlaybackLocation(null);
  }, []);

  const handleReplayPoint = useCallback((location: VehicleLocation | null) => {
    setPlaybackLocation(location);
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <VehicleLiveHeader
        customerName={customerName}
        plateNumber={vehicle.plate_number}
        deviceSerial={deviceSerial}
        status={vehicle.status}
        lastLocation={lastUpdate}
        isDemo={isDemo}
      />

      <section aria-label="Live map">
        <LiveMap
          location={currentLocation}
          route={route}
          playbackLocation={playbackLocation}
          className="h-[380px] md:h-[500px]"
          isDemo={isDemo}
        />
      </section>

      <section
        aria-label="Cameras and messaging"
        className="grid gap-6 lg:grid-cols-5"
      >
        <div className="space-y-3 lg:col-span-3">
          <h3 className="text-base font-semibold text-[#1C3664]">Camera Streams</h3>
          <CameraGrid vehicleId={vehicle.id} deviceType={deviceType ?? "combo"} />
        </div>

        <div className="space-y-3 lg:col-span-2">
          <h3 className="text-base font-semibold text-[#1C3664]">WhatsApp</h3>
          <WhatsappChatBox
            messages={messages}
            customerPhone={customerPhone}
            customerName={customerName}
            isDemo={isDemo}
          />
        </div>
      </section>

      <section aria-label="Location history">
        <LocationHistory
          history={history}
          onTripSelect={handleTripSelect}
          onReplayPoint={handleReplayPoint}
          isDemo={isDemo}
        />
      </section>
    </div>
  );
}
