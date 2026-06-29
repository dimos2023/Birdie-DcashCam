"use client";

import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Download, MapPin, Play, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VehicleLocation } from "@/lib/types";
import {
  filterLocationsByDateRange,
  groupLocationsIntoTrips,
  type Trip,
} from "@/lib/live/trips";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface LocationHistoryProps {
  history: VehicleLocation[];
  onTripSelect?: (trip: Trip | null) => void;
  onReplayPoint?: (location: VehicleLocation | null) => void;
}

export function LocationHistory({
  history,
  onTripSelect,
  onReplayPoint,
}: LocationHistoryProps) {
  const today = format(new Date(), "yyyy-MM-dd");
  const weekAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(weekAgo);
  const [dateTo, setDateTo] = useState(today);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);

  const filtered = useMemo(
    () => filterLocationsByDateRange(history, dateFrom, dateTo),
    [history, dateFrom, dateTo]
  );

  const trips = useMemo(() => groupLocationsIntoTrips(filtered), [filtered]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId) ?? null;
  const replayPoints = selectedTrip?.points ?? filtered;

  const handleTripSelect = (trip: Trip) => {
    const next = selectedTripId === trip.id ? null : trip.id;
    setSelectedTripId(next);
    setReplayIndex(0);
    const tripData = next ? trip : null;
    onTripSelect?.(tripData);
    onReplayPoint?.(tripData?.points[0] ?? null);
  };

  const handleReplay = () => {
    if (replayPoints.length === 0) return;
    const nextIndex = (replayIndex + 1) % replayPoints.length;
    setReplayIndex(nextIndex);
    onReplayPoint?.(replayPoints[nextIndex]);
  };

  const handleExport = () => {
    toast.info("Export coming soon", {
      description: "GPX and CSV export will be available in a future release.",
    });
  };

  if (history.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <Route className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-medium text-[#1C3664]">No location history</p>
        <p className="mt-1 text-sm text-muted-foreground">
          GPS data will appear here once the device reports its position.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b p-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="font-semibold text-[#1C3664]">Location History</h3>
          <p className="text-sm text-muted-foreground">
            {filtered.length} points · {trips.length} trip{trips.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="date-from" className="text-xs">
              From
            </Label>
            <Input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setSelectedTripId(null);
                onTripSelect?.(null);
              }}
              className="h-9 w-[140px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date-to" className="text-xs">
              To
            </Label>
            <Input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setSelectedTripId(null);
                onTripSelect?.(null);
              }}
              className="h-9 w-[140px]"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleReplay} className="h-9">
            <Play className="mr-1.5 h-4 w-4" />
            Replay
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[320px]">
        <div className="divide-y">
          {trips.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No trips in the selected date range.
            </p>
          )}
          {trips.map((trip) => {
            const isSelected = selectedTripId === trip.id;
            return (
              <button
                key={trip.id}
                type="button"
                onClick={() => handleTripSelect(trip)}
                className={cn(
                  "flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-[#F2F8FC]",
                  isSelected && "bg-[#F2F8FC]"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 rounded-lg p-2",
                    isSelected ? "bg-[#3B8ECC] text-white" : "bg-[#1C3664]/10 text-[#1C3664]"
                  )}
                >
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[#1C3664]">
                      {format(new Date(trip.startAt), "dd MMM yyyy")}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {trip.points.length} pts
                    </Badge>
                    {isSelected && (
                      <Badge className="bg-[#3B8ECC] text-xs hover:bg-[#3B8ECC]">
                        Selected
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(trip.startAt), "HH:mm")} –{" "}
                    {format(new Date(trip.endAt), "HH:mm")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {trip.distanceKm.toFixed(1)} km · max {Math.round(trip.maxSpeedKmh)} km/h
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedTripId(trip.id);
                    setReplayIndex(0);
                    onTripSelect?.(trip);
                    onReplayPoint?.(trip.points[0]);
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {selectedTrip && replayPoints.length > 1 && (
        <div className="border-t p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Trip scrubber</p>
          <input
            type="range"
            min={0}
            max={replayPoints.length - 1}
            value={replayIndex}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              setReplayIndex(idx);
              onReplayPoint?.(replayPoints[idx]);
            }}
            className="w-full accent-[#3B8ECC]"
            aria-label="Trip playback position"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{format(new Date(replayPoints[0].recorded_at), "HH:mm")}</span>
            <span>
              {replayIndex + 1} / {replayPoints.length}
            </span>
            <span>
              {format(
                new Date(replayPoints[replayPoints.length - 1].recorded_at),
                "HH:mm"
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
