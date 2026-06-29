"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/crud/form-select";
import { FormSubmitButton } from "@/components/crud/form-submit-button";
import { FormError } from "@/components/crud/form-error";
import type { Customer } from "@/lib/types";

const CONSENT_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "granted", label: "Granted" },
  { value: "declined", label: "Declined" },
];

interface CustomerFormProps {
  action: (formData: FormData) => void | Promise<void>;
  customer?: Customer;
  error?: string | null;
  submitLabel?: string;
}

export function CustomerForm({
  action,
  customer,
  error,
  submitLabel = "Save Customer",
}: CustomerFormProps) {
  return (
    <form action={action} className="space-y-5">
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            name="full_name"
            required
            defaultValue={customer?.name ?? ""}
            placeholder="Ahmed Al-Rashid"
            className="border-[#d4e4f0] bg-[#F2F8FC]/50 focus-visible:border-[#3B8ECC]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            defaultValue={customer?.phone ?? ""}
            placeholder="+966 5X XXX XXXX"
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
          <Input
            id="whatsapp_number"
            name="whatsapp_number"
            defaultValue={customer?.whatsapp_number ?? ""}
            placeholder="+966 5X XXX XXXX"
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
            placeholder="customer@company.com"
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            name="city"
            defaultValue={customer?.city ?? "Riyadh"}
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="consent_status">Consent Status</Label>
          <FormSelect
            id="consent_status"
            name="consent_status"
            defaultValue={customer?.consent_status ?? "pending"}
            options={CONSENT_OPTIONS}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={customer?.notes ?? ""}
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
          />
        </div>
      </div>
      <FormSubmitButton label={submitLabel} loadingLabel="Saving..." />
    </form>
  );
}
