"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertJtTerminal } from "@/lib/jt/terminal-actions";
import type { JtTerminal } from "@/lib/types";

interface Props {
  deviceId: string;
  terminal: JtTerminal | null;
  vehicleId?: string | null;
}

export function JtTerminalForm({ deviceId, terminal, vehicleId }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-4"
      action={(fd) => {
        fd.set("device_id", deviceId);
        if (vehicleId) fd.set("vehicle_id", vehicleId);
        startTransition(async () => {
          await upsertJtTerminal(fd);
        });
      }}
    >
      <input type="hidden" name="device_id" value={deviceId} />
      {vehicleId && <input type="hidden" name="vehicle_id" value={vehicleId} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="terminal_no">JT terminal number</Label>
          <Input id="terminal_no" name="terminal_no" defaultValue={terminal?.terminal_no ?? ""} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="media_sim_no">JT1078 media SIM</Label>
          <Input id="media_sim_no" name="media_sim_no" defaultValue={terminal?.media_sim_no ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imei">IMEI</Label>
          <Input id="imei" name="imei" defaultValue={terminal?.imei ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="terminal_id_code">Terminal ID</Label>
          <Input id="terminal_id_code" name="terminal_id_code" defaultValue={terminal?.terminal_id_code ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manufacturer_id">Manufacturer ID</Label>
          <Input id="manufacturer_id" name="manufacturer_id" defaultValue={terminal?.manufacturer_id ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="protocol_version">Protocol version</Label>
          <select
            id="protocol_version"
            name="protocol_version"
            defaultValue={terminal?.protocol_version ?? "auto"}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
          >
            <option value="auto">Auto</option>
            <option value="2011">2011</option>
            <option value="2019">2019</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone_offset_minutes">Timezone offset (minutes)</Label>
          <Input
            id="timezone_offset_minutes"
            name="timezone_offset_minutes"
            type="number"
            defaultValue={terminal?.timezone_offset_minutes ?? 180}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expected_video_channels">Expected channels</Label>
          <Input
            id="expected_video_channels"
            name="expected_video_channels"
            type="number"
            defaultValue={terminal?.expected_video_channels ?? 3}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="display_name">Display name</Label>
          <Input id="display_name" name="display_name" defaultValue={terminal?.display_name ?? ""} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="allow_auto_registration" defaultChecked={terminal?.allow_auto_registration} />
          Allow registration
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_enabled" defaultChecked={terminal?.is_enabled ?? true} />
          Enabled
        </label>
      </div>

      <Button type="submit" disabled={pending} className="bg-[#3B8ECC] hover:bg-[#3B8ECC]/90">
        {pending ? "Saving…" : "Save JT terminal"}
      </Button>
    </form>
  );
}
