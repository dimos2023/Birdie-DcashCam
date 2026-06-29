"use client";

import { Filter, X } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/crud/form-select";

interface CustomerOption {
  id: string;
  full_name: string;
}

interface ReportsFiltersProps {
  customers: CustomerOption[];
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "maintenance", label: "Maintenance" },
  { value: "decommissioned", label: "Decommissioned" },
];

const TYPE_OPTIONS = [
  { value: "gps_tracker", label: "GPS Tracker" },
  { value: "dash_cam", label: "Dash Cam" },
  { value: "combo", label: "Combo" },
];

export function ReportsFilters({ customers }: ReportsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQ = searchParams.get("q") ?? "";
  const currentStatus = searchParams.get("status") ?? "";
  const currentType = searchParams.get("type") ?? "";
  const currentCustomerId = searchParams.get("customer_id") ?? "";

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value.trim()) {
          params.set(key, value.trim());
        } else {
          params.delete(key);
        }
      }

      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  const clearFilters = () => {
    startTransition(() => {
      router.replace(pathname);
    });
  };

  const hasFilters = Boolean(currentQ || currentStatus || currentType || currentCustomerId);

  return (
    <div className="rounded-xl border border-[#e8f2fa] bg-white p-4 shadow-sm print:hidden">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-[#1C3664]">
        <Filter className="h-4 w-4 text-[#3B8ECC]" />
        Report filters
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2 md:col-span-2 xl:col-span-1">
          <Label htmlFor="reports-search">Search</Label>
          <Input
            id="reports-search"
            key={currentQ}
            defaultValue={currentQ}
            placeholder="Customer, plate, serial, IMEI..."
            className="border-[#d4e4f0] bg-[#F2F8FC]/50"
            disabled={isPending}
            onChange={(event) => updateParams({ q: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reports-status">Device status</Label>
          <FormSelect
            id="reports-status"
            value={currentStatus}
            onChange={(event) => updateParams({ status: event.target.value })}
            placeholder="All statuses"
            disabled={isPending}
            options={STATUS_OPTIONS}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reports-type">Device type</Label>
          <FormSelect
            id="reports-type"
            value={currentType}
            onChange={(event) => updateParams({ type: event.target.value })}
            placeholder="All types"
            disabled={isPending}
            options={TYPE_OPTIONS}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reports-customer">Customer</Label>
          <FormSelect
            id="reports-customer"
            value={currentCustomerId}
            onChange={(event) => updateParams({ customer_id: event.target.value })}
            placeholder="All customers"
            disabled={isPending}
            options={customers.map((customer) => ({
              value: customer.id,
              label: customer.full_name,
            }))}
          />
        </div>
      </div>
      {hasFilters && (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-[#3B8ECC] hover:bg-[#F2F8FC] hover:text-[#1C3664]"
            onClick={clearFilters}
            disabled={isPending}
          >
            <X className="mr-1 h-4 w-4" />
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
