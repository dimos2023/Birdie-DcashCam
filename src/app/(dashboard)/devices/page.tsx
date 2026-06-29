import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export const metadata = { title: "Devices" };

export default async function DevicesPage() {
  const supabase = await createClient();
  const { data: devices } = await supabase
    .from("devices")
    .select("*, device_models(name, type)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Devices" description="Manage Birdie dash cams and GPS trackers">
        <LinkButton href="/devices/new" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
          <Plus className="mr-2 h-4 w-4" />
          Register Device
        </LinkButton>
      </PageHeader>
      <div className="p-4 md:p-6">
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial Number</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>IMEI</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No devices registered
                  </TableCell>
                </TableRow>
              )}
              {devices?.map((device) => {
                const model = (device as { device_models?: { name: string; type: string } }).device_models;
                return (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium text-[#1C3664]">
                      {device.serial_number}
                    </TableCell>
                    <TableCell>
                      {model ? `${model.name} (${model.type})` : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{device.imei ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          device.status === "active"
                            ? "default"
                            : device.status === "maintenance"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {device.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {device.last_seen_at
                        ? format(new Date(device.last_seen_at), "dd MMM yyyy, HH:mm")
                        : "Never"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
