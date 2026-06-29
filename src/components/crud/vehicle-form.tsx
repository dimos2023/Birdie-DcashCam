"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/crud/form-select";
import { FormSubmitButton } from "@/components/crud/form-submit-button";
import { FormError } from "@/components/crud/form-error";
import { LinkButton } from "@/components/ui/link-button";
import type { Vehicle } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "maintenance", label: "Maintenance" },
];

interface CustomerOption {
  id: string;
  name: string;
}

interface VehicleFormProps {
  action: (formData: FormData) => void | Promise<void>;
  vehicle?: Vehicle;
  customers: CustomerOption[];
  error?: string | null;
  submitLabel?: string;
  cancelHref?: string;
}

export function VehicleForm({
  action,
  vehicle,
  customers,
  error,
  submitLabel = "Save Vehicle",
  cancelHref = "/vehicles",
}: VehicleFormProps) {
  return (
    <form action={action} className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="plate_number">Plate Number *</Label>
          <Input
            id="plate_number"
            name="plate_number"
            required
            defaultValue={vehicle?.plate_number ?? ""}
            placeholder="ABC 1234"
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="customer_id">Customer</Label>
          <FormSelect
            id="customer_id"
            name="customer_id"
            defaultValue={vehicle?.customer_id ?? ""}
            placeholder="No customer"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand">Brand</Label>
          <Input
            id="brand"
            name="brand"
            defaultValue={vehicle?.make ?? ""}
            placeholder="Toyota"
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            name="model"
            defaultValue={vehicle?.model ?? ""}
            placeholder="Hilux"
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="year">Year</Label>
          <Input
            id="year"
            name="year"
            type="number"
            min={1990}
            max={2035}
            defaultValue={vehicle?.year ?? ""}
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            name="color"
            defaultValue={vehicle?.color ?? ""}
            placeholder="White"
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="status">Status</Label>
          <FormSelect
            id="status"
            name="status"
            defaultValue={vehicle?.status ?? "active"}
            options={STATUS_OPTIONS}
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
