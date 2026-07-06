"use client";

import {
  Activity,
  CircleHelp,
  MapPin,
  Radio,
  Satellite,
  WifiOff,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Gps51FleetSummary } from "@/lib/gps51/fleet-utils";
import {
  STATUS_SNAPSHOT_TOOLTIP,
  UNKNOWN_STATUS_TOOLTIP,
} from "@/lib/gps51/fleet-utils";

interface Gps51SummaryCardsProps {
  summary: Gps51FleetSummary;
}

function StatusStatCard({
  title,
  value,
  icon: Icon,
  tooltip,
}: {
  title: string;
  value: number;
  icon: typeof Radio;
  tooltip: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="block w-full text-left">
          <StatCard title={title} value={value} icon={Icon} />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function UnknownStatCard({ value }: { value: number }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="block w-full text-left">
          <StatCard title="Unknown" value={value} icon={CircleHelp} />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{UNKNOWN_STATUS_TOOLTIP}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function Gps51SummaryCards({ summary }: Gps51SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard title="Total Devices" value={summary.total} icon={Satellite} />
      <StatusStatCard
        title="Online"
        value={summary.online}
        icon={Radio}
        tooltip={STATUS_SNAPSHOT_TOOLTIP}
      />
      <StatusStatCard
        title="Offline"
        value={summary.offline}
        icon={WifiOff}
        tooltip={STATUS_SNAPSHOT_TOOLTIP}
      />
      <UnknownStatCard value={summary.unknown} />
      <StatCard title="Devices With Position" value={summary.withPosition} icon={MapPin} />
      <StatCard
        title="Seen In Last 10 Min"
        value={summary.seenRecently}
        icon={Activity}
        description="Based on live position timestamps (last_seen_at / received_at)"
      />
    </div>
  );
}
