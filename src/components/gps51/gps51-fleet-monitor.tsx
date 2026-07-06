"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Radio, Satellite, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Gps51WebDeviceLive } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Gps51SummaryCards } from "@/components/gps51/gps51-summary-cards";
import { Gps51Filters } from "@/components/gps51/gps51-filters";
import { Gps51DeviceTable } from "@/components/gps51/gps51-device-table";
import { Gps51DeviceDetailsSheet } from "@/components/gps51/gps51-device-details-sheet";
import {
  DEFAULT_GPS51_FILTERS,
  PAGE_SIZE,
  collectGroupPaths,
  computeFleetSummary,
  filterGps51Devices,
  type Gps51FleetFilters,
} from "@/lib/gps51/fleet-utils";
import { cn } from "@/lib/utils";

const Gps51FleetMap = dynamic(
  () => import("@/components/gps51/gps51-fleet-map").then((mod) => mod.Gps51FleetMap),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[360px] animate-pulse rounded-2xl border border-[#e8f2fa] bg-[#F2F8FC]" />
    ),
  }
);

interface Gps51FleetMonitorProps {
  initialDevices: Gps51WebDeviceLive[];
  organizationId: string;
  initialError?: string | null;
}

type RealtimeState = "connected" | "connecting" | "disconnected";

export function Gps51FleetMonitor({
  initialDevices,
  organizationId,
  initialError = null,
}: Gps51FleetMonitorProps) {
  const [devices, setDevices] = useState(initialDevices);
  const [filters, setFilters] = useState<Gps51FleetFilters>(DEFAULT_GPS51_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>("connecting");
  const [queryError, setQueryError] = useState<string | null>(initialError);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredDevices = useMemo(
    () => filterGps51Devices(devices, filters),
    [devices, filters]
  );

  const summary = useMemo(() => computeFleetSummary(devices), [devices]);
  const groupOptions = useMemo(() => collectGroupPaths(devices), [devices]);
  const selectedDevice = useMemo(
    () => devices.find((device) => device.gps51_device_id === selectedId) ?? null,
    [devices, selectedId]
  );

  const refreshDevices = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("gps51_web_device_live")
      .select("*")
      .eq("organization_id", organizationId)
      .order("device_name", { ascending: true, nullsFirst: false });

    if (error) {
      setQueryError(error.message);
      return;
    }

    setQueryError(null);
    if (data) setDevices(data as Gps51WebDeviceLive[]);
  }, [organizationId]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      void refreshDevices();
    }, 400);
  }, [refreshDevices]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`gps51-fleet-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gps51_web_devices",
          filter: `organization_id=eq.${organizationId}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gps51_web_latest_positions",
          filter: `organization_id=eq.${organizationId}`,
        },
        scheduleRefresh
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeState("connected");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeState("disconnected");
        } else {
          setRealtimeState("connecting");
        }
      });

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, scheduleRefresh]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const handleSelect = (deviceId: string) => {
    setSelectedId(deviceId);
    setDetailsOpen(true);
  };

  const handleFilterChange = (patch: Partial<Gps51FleetFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  if (queryError && devices.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Unable to load GPS51 devices</AlertTitle>
        <AlertDescription>{queryError}</AlertDescription>
      </Alert>
    );
  }

  if (devices.length === 0) {
    return (
      <EmptyState
        icon={Satellite}
        title="No GPS51 devices synchronized"
        description="Run GPS51 inventory sync on the worker to populate devices for your organization."
      />
    );
  }

  const hasLivePositions = summary.withPosition > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
            realtimeState === "connected" && "border-emerald-200 bg-emerald-50 text-emerald-800",
            realtimeState === "connecting" && "border-amber-200 bg-amber-50 text-amber-800",
            realtimeState === "disconnected" && "border-red-200 bg-red-50 text-red-800"
          )}
        >
          <span
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              realtimeState === "connected" && "bg-emerald-500",
              realtimeState === "connecting" && "animate-pulse bg-amber-500",
              realtimeState === "disconnected" && "bg-red-500"
            )}
          />
          {realtimeState === "connected"
            ? "Live updates connected"
            : realtimeState === "connecting"
              ? "Connecting to live updates..."
              : "Realtime disconnected"}
        </div>
        <p className="text-sm text-muted-foreground">
          Source: GPS51 Web · {devices.length} synchronized devices
        </p>
      </div>

      <Gps51SummaryCards summary={summary} />

      {!hasLivePositions && (
        <Alert>
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Inventory loaded — live positions pending</AlertTitle>
          <AlertDescription>
            All synchronized devices are visible below. GPS coordinates will appear when the live
            WebSocket worker writes positions to Supabase.
          </AlertDescription>
        </Alert>
      )}

      <Gps51Filters
        filters={filters}
        groupOptions={groupOptions}
        onChange={handleFilterChange}
        onClear={() => setFilters(DEFAULT_GPS51_FILTERS)}
      />

      <Gps51FleetMap
        devices={filteredDevices}
        selectedId={selectedId}
        onSelect={handleSelect}
      />

      {filteredDevices.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No devices match your filters"
          description="Adjust or clear filters to see synchronized GPS51 devices."
        />
      ) : (
        <Gps51DeviceTable
          devices={filteredDevices}
          page={page}
          pageSize={PAGE_SIZE}
          selectedId={selectedId}
          onSelect={handleSelect}
          onPageChange={setPage}
        />
      )}

      <Gps51DeviceDetailsSheet
        device={selectedDevice}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
