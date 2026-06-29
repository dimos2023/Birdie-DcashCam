"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/crud/form-select";
import { FormSubmitButton } from "@/components/crud/form-submit-button";
import { FormError } from "@/components/crud/form-error";
import { LinkButton } from "@/components/ui/link-button";
import type { Device } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "inactive", label: "Inactive" },
  { value: "active", label: "Active" },
  { value: "maintenance", label: "Maintenance" },
  { value: "decommissioned", label: "Decommissioned" },
];

type DeviceWithDates = Device & {
  activation_date?: string | null;
  warranty_start?: string | null;
  warranty_end?: string | null;
};

interface ModelOption {
  id: string;
  name: string;
  type: string;
}

interface DeviceFormProps {
  action: (formData: FormData) => void | Promise<void>;
  device?: DeviceWithDates;
  models: ModelOption[];
  error?: string | null;
  submitLabel?: string;
  cancelHref?: string;
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function DeviceForm({
  action,
  device,
  models,
  error,
  submitLabel = "Save Device",
  cancelHref = "/devices",
}: DeviceFormProps) {
  return (
    <form action={action} className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="serial_number">Serial Number *</Label>
          <Input
            id="serial_number"
            name="serial_number"
            required
            defaultValue={device?.serial_number ?? ""}
            placeholder="BD-XXXX-XXXX"
            className="border-[#d4e4f0] bg-[#F2F8FC]/50 font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="device_model_id">Device Model</Label>
          <FormSelect
            id="device_model_id"
            name="device_model_id"
            defaultValue={device?.device_model_id ?? ""}
            placeholder="Select model"
            options={models.map((m) => ({
              value: m.id,
              label: `${m.name} (${m.type.replace("_", " ")})`,
            }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <FormSelect
            id="status"
            name="status"
            defaultValue={device?.status ?? "inactive"}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imei">IMEI</Label>
          <Input
            id="imei"
            name="imei"
            defaultValue={device?.imei ?? ""}
            className="border-[#d4e4f0] bg-[#F2F8FC]/50 font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sim_number">SIM Number</Label>
          <Input
            id="sim_number"
            name="sim_number"
            defaultValue={device?.sim_number ?? ""}
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="activation_date">Activation Date</Label>
          <Input
            id="activation_date"
            name="activation_date"
            type="date"
            defaultValue={dateInputValue(device?.activation_date)}
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="warranty_start">Warranty Start</Label>
          <Input
            id="warranty_start"
            name="warranty_start"
            type="date"
            defaultValue={dateInputValue(device?.warranty_start)}
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="warranty_end">Warranty End</Label>
          <Input
            id="warranty_end"
            name="warranty_end"
            type="date"
            defaultValue={dateInputValue(device?.warranty_end)}
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <FormSubmitButton label={submitLabel} loadingLabel="Saving..." />
        <LinkButton href={cancelHref} variant="outline">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
