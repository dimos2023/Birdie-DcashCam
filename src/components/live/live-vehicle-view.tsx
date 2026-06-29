"use client";

import { useCallback, useMemo, useState } from "react";
import { LiveSummaryCards } from "@/components/live/live-summary-cards";
import { LiveMap } from "@/components/live/live-map";
import { CameraGrid } from "@/components/live/camera-grid";
import { WhatsappChatBox } from "@/components/live/whatsapp-chat-box";
import { LocationHistory } from "@/components/live/location-history";
import type {
  Vehicle,
  VehicleLocation,
  CameraStream,
  WhatsappConversation,
  WhatsappMessage,
} from "@/lib/types";
import type { Trip } from "@/lib/live/trips";

type DeviceType = "dash_cam" | "gps_tracker" | "combo" | null;

interface LiveVehicleViewProps {
  vehicle: Vehicle;
  initialLocation: VehicleLocation | null;
  history: VehicleLocation[];
  streams: CameraStream[];
  conversation: WhatsappConversation | null;
  messages: WhatsappMessage[];
  customerName?: string | null;
  customerPhone?: string | null;
  deviceSerial?: string | null;
  deviceType?: DeviceType;
}

export function LiveVehicleView({
  vehicle,
  initialLocation,
  history,
  streams,
  conversation,
  messages,
  customerName,
  customerPhone,
  deviceSerial,
  deviceType,
}: LiveVehicleViewProps) {
  const [liveLocation, setLiveLocation] = useState<VehicleLocation | null>(initialLocation);
  const [playbackLocation, setPlaybackLocation] = useState<VehicleLocation | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const route = useMemo(
    () => selectedTrip?.points ?? history,
    [selectedTrip, history]
  );

  const handleLocationUpdate = useCallback((location: VehicleLocation) => {
    setLiveLocation(location);
    if (!playbackLocation) {
      setPlaybackLocation(null);
    }
  }, [playbackLocation]);

  const handleReplayPoint = useCallback((location: VehicleLocation | null) => {
    setPlaybackLocation(location);
  }, []);

  const handleTripSelect = useCallback((trip: Trip | null) => {
    setSelectedTrip(trip);
    if (!trip) {
      setPlaybackLocation(null);
    }
  }, []);

  const lastUpdate = playbackLocation ?? liveLocation ?? initialLocation;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <LiveSummaryCards
        customerName={customerName}
        plateNumber={vehicle.plate_number}
        deviceSerial={deviceSerial}
        status={vehicle.status}
        lastLocation={lastUpdate}
      />

      <section aria-label="Live map">
        <LiveMap
          vehicleId={vehicle.id}
          initialLocation={initialLocation}
          route={route}
          playbackLocation={playbackLocation}
          onLocationUpdate={handleLocationUpdate}
          className="h-[360px] md:h-[480px]"
        />
      </section>

      <section
        aria-label="Cameras and messaging"
        className="grid gap-6 xl:grid-cols-3"
      >
        <div className="space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#1C3664]">Camera Streams</h3>
            <span className="text-xs text-muted-foreground">
              {deviceType === "combo" ? "3 channels" : deviceType === "dash_cam" ? "2 channels" : "Video"}
            </span>
          </div>
          <CameraGrid
            vehicleId={vehicle.id}
            streams={streams}
            deviceType={deviceType}
          />
        </div>

        <div className="space-y-3">
          <h3 className="text-base font-semibold text-[#1C3664]">WhatsApp</h3>
          <WhatsappChatBox
            conversation={conversation}
            messages={messages}
            customerPhone={customerPhone}
            customerName={customerName}
          />
        </div>
      </section>

      <section aria-label="Location history">
        <LocationHistory
          history={history}
          onTripSelect={handleTripSelect}
          onReplayPoint={handleReplayPoint}
        />
      </section>
    </div>
  );
}
