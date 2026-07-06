"use client";

import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/crud/form-select";
import type { Gps51FleetFilters } from "@/lib/gps51/fleet-utils";

interface Gps51FiltersProps {
  filters: Gps51FleetFilters;
  groupOptions: string[];
  onChange: (patch: Partial<Gps51FleetFilters>) => void;
  onClear: () => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "unknown", label: "Unknown" },
  { value: "stale", label: "Stale" },
];

const POSITION_OPTIONS = [
  { value: "all", label: "Any position" },
  { value: "yes", label: "Has position" },
  { value: "no", label: "No position" },
];

const ACC_OPTIONS = [
  { value: "all", label: "Any ACC" },
  { value: "on", label: "ACC On" },
  { value: "off", label: "ACC Off" },
];

export function Gps51Filters({ filters, groupOptions, onChange, onClear }: Gps51FiltersProps) {
  const hasFilters =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.group !== "all" ||
    filters.hasPosition !== "all" ||
    filters.acc !== "all" ||
    filters.recentlyUpdated;

  return (
    <div className="rounded-xl border border-[#e8f2fa] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-[#1C3664]">
          <Filter className="h-4 w-4 text-[#3B8ECC]" />
          Filters
        </div>
        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1 h-3.5 w-3.5" />
            Clear Filters
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="gps51-search">Search</Label>
          <Input
            id="gps51-search"
            placeholder="Device name or ID..."
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <FormSelect
            value={filters.status}
            onChange={(e) =>
              onChange({ status: e.target.value as Gps51FleetFilters["status"] })
            }
            options={STATUS_OPTIONS}
          />
        </div>

        <div className="space-y-2">
          <Label>Group / Account</Label>
          <FormSelect
            value={filters.group}
            onChange={(e) => onChange({ group: e.target.value })}
            options={[
              { value: "all", label: "All groups" },
              ...groupOptions.map((group) => ({ value: group, label: group })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label>Position</Label>
          <FormSelect
            value={filters.hasPosition}
            onChange={(e) =>
              onChange({ hasPosition: e.target.value as Gps51FleetFilters["hasPosition"] })
            }
            options={POSITION_OPTIONS}
          />
        </div>

        <div className="space-y-2">
          <Label>ACC</Label>
          <FormSelect
            value={filters.acc}
            onChange={(e) => onChange({ acc: e.target.value as Gps51FleetFilters["acc"] })}
            options={ACC_OPTIONS}
          />
        </div>

        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#1C3664]">
            <input
              type="checkbox"
              className="size-4 rounded border-[#d4e4f0]"
              checked={filters.recentlyUpdated}
              onChange={(e) => onChange({ recentlyUpdated: e.target.checked })}
            />
            Recently updated (10 min)
          </label>
        </div>
      </div>
    </div>
  );
}
