import { Suspense } from "react";
import { format } from "date-fns";
import { Cpu, Eye, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmButton } from "@/components/ui/delete-confirm-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntitySearch } from "@/components/crud/entity-search";
import { ListEmptyState } from "@/components/crud/list-empty-state";
import { createClient } from "@/lib/supabase/server";
import { deleteDevice } from "@/app/(dashboard)/devices/actions";

export const metadata = { title: "Devices" };

function deviceStatusVariant(status: string) {
  if (status === "active") return "default" as const;
  if (status === "maintenance") return "secondary" as const;
  return "outline" as const;
}

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("devices")
    .select("*, device_models(name, category)")
    .order("created_at", { ascending: false });

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`serial_number.ilike.${term},imei.ilike.${term},sim_number.ilike.${term}`);
  }

  const { data: devices } = await query;

  return (
    <>
      <PageHeader title="Devices" description="Manage Birdie dash cams and GPS trackers">
        <LinkButton href="/devices/new" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
          <Plus className="mr-2 h-4 w-4" />
          Register Device
        </LinkButton>
      </PageHeader>
      <div className="space-y-4 p-4 md:p-6">
        <Suspense fallback={null}>
          <EntitySearch placeholder="Search by serial, IMEI, SIM..." />
        </Suspense>

        <div className="overflow-hidden rounded-xl border border-[#e8f2fa] bg-white shadow-sm">
          {!devices?.length ? (
            <ListEmptyState
              icon={Cpu}
              title={q ? "No devices match your search" : "No devices registered"}
              description={
                q
                  ? "Try a different search term or clear the filter."
                  : "Register Birdie hardware to assign to vehicles and start tracking."
              }
              actionLabel="Register Device"
              actionHref="/devices/new"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>SIM</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activation Date</TableHead>
                    <TableHead>Warranty End</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => {
                    const model = (device as {
                      device_models?: { name: string; category: string };
                    }).device_models;
                    return (
                      <TableRow key={device.id} className="hover:bg-[#F2F8FC]/60">
                        <TableCell className="font-mono font-medium text-[#1C3664]">
                          {device.serial_number}
                        </TableCell>
                        <TableCell>{model?.name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{device.imei ?? "—"}</TableCell>
                        <TableCell>{device.sim_number ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={deviceStatusVariant(device.status)}>
                            {device.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {device.activation_date
                            ? format(new Date(device.activation_date), "dd MMM yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {device.warranty_end
                            ? format(new Date(device.warranty_end), "dd MMM yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <LinkButton href={`/devices/${device.id}`} size="sm" variant="ghost">
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              View
                            </LinkButton>
                            <LinkButton
                              href={`/devices/${device.id}/edit`}
                              size="sm"
                              variant="outline"
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </LinkButton>
                            <DeleteConfirmButton
                              id={device.id}
                              confirmMessage="Are you sure you want to delete this device?"
                              deleteAction={deleteDevice}
                              redirectTo="/devices"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
