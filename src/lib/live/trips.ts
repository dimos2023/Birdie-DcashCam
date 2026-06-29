import type { VehicleLocation } from "@/lib/types";

export interface Trip {
  id: string;
  startAt: string;
  endAt: string;
  points: VehicleLocation[];
  distanceKm: number;
  maxSpeedKmh: number;
}

const TRIP_GAP_MS = 20 * 60 * 1000;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildTrip(points: VehicleLocation[], index: number): Trip {
  let distanceKm = 0;
  let maxSpeedKmh = 0;

  for (let i = 1; i < points.length; i++) {
    distanceKm += haversineKm(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
    maxSpeedKmh = Math.max(maxSpeedKmh, points[i].speed_kmh ?? 0);
  }

  return {
    id: `trip-${index}-${points[0].id}`,
    startAt: points[0].recorded_at,
    endAt: points[points.length - 1].recorded_at,
    points,
    distanceKm,
    maxSpeedKmh,
  };
}

export function groupLocationsIntoTrips(locations: VehicleLocation[]): Trip[] {
  if (locations.length === 0) return [];

  const sorted = [...locations].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const trips: Trip[] = [];
  let current: VehicleLocation[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const gap =
      new Date(sorted[i].recorded_at).getTime() -
      new Date(sorted[i - 1].recorded_at).getTime();

    if (gap > TRIP_GAP_MS) {
      trips.push(buildTrip(current, trips.length));
      current = [sorted[i]];
    } else {
      current.push(sorted[i]);
    }
  }

  trips.push(buildTrip(current, trips.length));
  return trips.reverse();
}

export function filterLocationsByDateRange(
  locations: VehicleLocation[],
  from: string,
  to: string
): VehicleLocation[] {
  if (!from && !to) return locations;

  const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : 0;
  const toTime = to ? new Date(`${to}T23:59:59`).getTime() : Infinity;

  return locations.filter((loc) => {
    const t = new Date(loc.recorded_at).getTime();
    return t >= fromTime && t <= toTime;
  });
}
