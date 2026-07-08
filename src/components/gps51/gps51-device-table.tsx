"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Gps51WebDeviceLive } from "@/lib/types";
import {
  getPositionSourceLabel,
  UNKNOWN_STATUS_TOOLTIP,
  formatCoordinates,
  getDisplayStatus,
  statusBadgeClass,
  statusLabel,
} from "@/lib/gps51/fleet-utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Gps51TimeCell } from "@/components/gps51/gps51-time-cell";
import { cn } from "@/lib/utils";

interface Gps51DeviceTableProps {
  devices: Gps51WebDeviceLive[];
  page: number;
  pageSize: number;
  selectedId: string | null;
  onSelect: (deviceId: string) => void;
  onPageChange: (page: number) => void;
}

export function Gps51DeviceTable({
  devices,
  page,
  pageSize,
  selectedId,
  onSelect,
  onPageChange,
}: Gps51DeviceTableProps) {
  const totalPages = Math.max(1, Math.ceil(devices.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pageDevices = devices.slice(start, start + pageSize);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[#e8f2fa] bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Device Name</TableHead>
              <TableHead>Device ID</TableHead>
              <TableHead>Group / Account Path</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Seen</TableHead>
              <TableHead>Last GPS Time</TableHead>
              <TableHead>Speed</TableHead>
              <TableHead>ACC</TableHead>
              <TableHead>Coordinates</TableHead>
              <TableHead>Signal</TableHead>
              <TableHead>Satellites</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageDevices.map((device) => {
              const displayStatus = getDisplayStatus(device);
              return (
                <TableRow
                  key={device.gps51_device_id}
                  className={cn(
                    "cursor-pointer hover:bg-[#F2F8FC]/70",
                    selectedId === device.gps51_device_id && "bg-[#3B8ECC]/10"
                  )}
                  onClick={() => onSelect(device.gps51_device_id)}
                >
                  <TableCell className="max-w-[180px] truncate font-medium text-[#1C3664]">
                    {device.device_name ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{device.source_device_id}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">
                    {device.group_path ?? "—"}
                  </TableCell>
                  <TableCell>
                    {displayStatus === "unknown" ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            className={cn(
                              "inline-flex cursor-default rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                              statusBadgeClass(displayStatus)
                            )}
                          >
                            {statusLabel(displayStatus)}
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">{UNKNOWN_STATUS_TOOLTIP}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn("border", statusBadgeClass(displayStatus))}
                      >
                        {statusLabel(displayStatus)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Gps51TimeCell value={device.last_seen_at} />
                  </TableCell>
                  <TableCell>
                    <Gps51TimeCell value={device.source_located_at ?? device.received_at} />
                  </TableCell>
                  <TableCell>
                    {device.speed_kmh != null ? `${device.speed_kmh} km/h` : "—"}
                  </TableCell>
                  <TableCell>
                    {device.acc_on == null ? "—" : device.acc_on ? "On" : "Off"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {formatCoordinates(device.latitude, device.longitude)}
                  </TableCell>
                  <TableCell>
                    {device.cellular_signal_percent != null
                      ? `${device.cellular_signal_percent}%`
                      : "—"}
                  </TableCell>
                  <TableCell>{device.satellite_count ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{getPositionSourceLabel(device)}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>
          Showing {devices.length === 0 ? 0 : start + 1}–
          {Math.min(start + pageSize, devices.length)} of {devices.length} filtered devices
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <span>
            Page {currentPage} / {totalPages}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
