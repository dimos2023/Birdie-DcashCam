import type { VehicleLocation, WhatsappMessage } from "@/lib/types";

/** Riyadh city center — default demo coordinates */
const RIYADH = { lat: 24.7136, lng: 46.6753 };

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

/** Generates a short demo route through Riyadh for map + history. */
export function getPlaceholderLocations(
  vehicleId: string,
  organizationId: string
): VehicleLocation[] {
  const points: Array<{
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    minutesAgo: number;
    ignition: boolean;
  }> = [
    { lat: 24.687, lng: 46.721, speed: 0, heading: 90, minutesAgo: 45, ignition: false },
    { lat: 24.695, lng: 46.71, speed: 32, heading: 85, minutesAgo: 42, ignition: true },
    { lat: 24.702, lng: 46.698, speed: 48, heading: 80, minutesAgo: 38, ignition: true },
    { lat: 24.709, lng: 46.685, speed: 55, heading: 75, minutesAgo: 34, ignition: true },
    { lat: 24.7136, lng: 46.6753, speed: 42, heading: 70, minutesAgo: 28, ignition: true },
    { lat: 24.718, lng: 46.668, speed: 38, heading: 65, minutesAgo: 22, ignition: true },
    { lat: 24.725, lng: 46.662, speed: 25, heading: 60, minutesAgo: 15, ignition: true },
    { lat: 24.731, lng: 46.655, speed: 12, heading: 55, minutesAgo: 8, ignition: true },
    { lat: 24.735, lng: 46.648, speed: 0, heading: 50, minutesAgo: 2, ignition: false },
  ];

  return points.map((p, i) => ({
    id: `demo-loc-${i}`,
    organization_id: organizationId,
    vehicle_id: vehicleId,
    device_id: null,
    latitude: p.lat,
    longitude: p.lng,
    speed_kmh: p.speed,
    heading: p.heading,
    altitude_m: null,
    accuracy_m: 8,
    ignition_on: p.ignition,
    recorded_at: minutesAgo(p.minutesAgo),
    created_at: minutesAgo(p.minutesAgo),
  }));
}

export function getPlaceholderCurrentLocation(
  vehicleId: string,
  organizationId: string
): VehicleLocation {
  const history = getPlaceholderLocations(vehicleId, organizationId);
  return history[history.length - 1];
}

export function getPlaceholderWhatsappMessages(
  organizationId: string,
  conversationId: string
): WhatsappMessage[] {
  return [
    {
      id: "demo-msg-1",
      organization_id: organizationId,
      conversation_id: conversationId,
      direction: "inbound",
      body: "Hello, can you share my vehicle location?",
      wa_message_id: null,
      status: "delivered",
      sent_at: hoursAgo(3),
      created_at: hoursAgo(3),
    },
    {
      id: "demo-msg-2",
      organization_id: organizationId,
      conversation_id: conversationId,
      direction: "outbound",
      body: "Your vehicle location has been shared. You can view live tracking on the dashboard.",
      wa_message_id: null,
      status: "sent",
      sent_at: hoursAgo(2.9),
      created_at: hoursAgo(2.9),
    },
    {
      id: "demo-msg-3",
      organization_id: organizationId,
      conversation_id: conversationId,
      direction: "inbound",
      body: "Thank you! Is the dash cam recording?",
      wa_message_id: null,
      status: "delivered",
      sent_at: hoursAgo(2.5),
      created_at: hoursAgo(2.5),
    },
    {
      id: "demo-msg-4",
      organization_id: organizationId,
      conversation_id: conversationId,
      direction: "outbound",
      body: "Yes, all cameras are online and recording. Live stream is available.",
      wa_message_id: null,
      status: "sent",
      sent_at: hoursAgo(2.4),
      created_at: hoursAgo(2.4),
    },
  ];
}

export { RIYADH };
