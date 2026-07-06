"use client";

import {
  Activity,
  CircleHelp,
  MapPin,
  Radio,
  Satellite,
  WifiOff,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import type { Gps51FleetSummary } from "@/lib/gps51/fleet-utils";

interface Gps51SummaryCardsProps {
  summary: Gps51FleetSummary;
}

export function Gps51SummaryCards({ summary }: Gps51SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <StatCard title="Total Devices" value={summary.total} icon={Satellite} />
      <StatCard title="Online" value={summary.online} icon={Radio} />
      <StatCard title="Offline" value={summary.offline} icon={WifiOff} />
      <StatCard title="Unknown" value={summary.unknown} icon={CircleHelp} />
      <StatCard title="Devices With Position" value={summary.withPosition} icon={MapPin} />
      <StatCard
        title="Seen In Last 10 Min"
        value={summary.seenRecently}
        icon={Activity}
        description="Based on last seen or GPS receive time"
      />
    </div>
  );
}
