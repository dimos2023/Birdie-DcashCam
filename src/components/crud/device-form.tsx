"use client";

import { useMemo, useState } from "react";
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
  category: string;
}

export interface CustomerOption {
  id: string;
  full_name: string;
  phone?: string | null;
  whatsapp_number?: string | null;
}

export interface VehicleOption {
  id: string;
  customer_id: string | null;
  plate_number: string;
  brand?: string | null;
  customer_name?: string;
}

interface DeviceFormProps {
  action: (formData: FormData) => void | Promise<void>;
  device?: DeviceWithDates;
  models: ModelOption[];
  customers: CustomerOption[];
  vehicles: VehicleOption[];
  defaultVehicleId?: string | null;
  error?: string | null;
  submitLabel?: string;
  cancelHref?: string;
}

function dateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatCustomerLabel(customer: CustomerOption): string {
  const name = customer.full_name?.trim() || "Unnamed Customer";
  const contact = customer.phone?.trim() || customer.whatsapp_number?.trim();
  return contact ? `${name} — ${contact}` : name;
}

function formatVehicleLabel(vehicle: VehicleOption): string {
  const owner = vehicle.customer_name?.trim() || "Unnamed Customer";
  const details = [vehicle.plate_number, vehicle.brand].filter(Boolean).join(" · ");
  return `${details} — ${owner}`;
}

export function DeviceForm({
  action,
  device,
  models,
  customers,
  vehicles,
  defaultVehicleId,
  error,
  submitLabel = "Save Device",
  cancelHref = "/devices",
}: DeviceFormProps) {
  const [customerId, setCustomerId] = useState(device?.customer_id ?? "");

  const filteredVehicles = useMemo(() => {
    if (!customerId) return vehicles;
    return vehicles.filter((vehicle) => vehicle.customer_id === customerId);
  }, [customerId, vehicles]);

  const vehicleOptions = useMemo(
    () =>
      filteredVehicles.map((vehicle) => ({
        value: vehicle.id,
        label: formatVehicleLabel(vehicle),
      })),
    [filteredVehicles]
  );

  const selectedVehicleStillValid =
    !defaultVehicleId || filteredVehicles.some((vehicle) => vehicle.id === defaultVehicleId);

  return (
    <form action={action} className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="customer_id">Customer / Device Owner *</Label>
          <FormSelect
            id="customer_id"
            name="customer_id"
            required
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            placeholder="Select customer"
            options={customers.map((customer) => ({
              value: customer.id,
              label: formatCustomerLabel(customer),
            }))}
          />
          <p className="text-xs text-muted-foreground">
            Select the customer who owns this device.
          </p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="vehicle_id">Assigned Vehicle</Label>
          <FormSelect
            key={customerId}
            id="vehicle_id"
            name="vehicle_id"
            defaultValue={selectedVehicleStillValid ? (defaultVehicleId ?? "") : ""}
            placeholder={
              customerId && filteredVehicles.length === 0
                ? "No vehicles for this customer"
                : "No vehicle assigned"
            }
            disabled={Boolean(customerId) && filteredVehicles.length === 0}
            options={vehicleOptions}
          />
          <p className="text-xs text-muted-foreground">
            Optionally link the device to one of the customer&apos;s vehicles.
          </p>
        </div>
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
              label: `${m.name} (${m.category.replace(/_/g, " ")})`,
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
