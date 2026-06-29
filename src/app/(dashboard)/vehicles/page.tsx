import Link from "next/link";
import { Plus, Radio } from "lucide-react";
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

export const metadata = { title: "Vehicles" };

export default async function VehiclesPage() {
  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Vehicles" description="Monitor and manage fleet vehicles">
        <LinkButton href="/vehicles/new" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </LinkButton>
      </PageHeader>
      <div className="p-4 md:p-6">
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plate</TableHead>
                <TableHead>Make / Model</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No vehicles found
                  </TableCell>
                </TableRow>
              )}
              {vehicles?.map((vehicle) => (
                <TableRow key={vehicle.id}>
                  <TableCell>
                    <Link href={`/vehicles/${vehicle.id}`} className="font-medium text-[#1C3664]">
                      {vehicle.plate_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                  <TableCell>
                    {(vehicle as { customers?: { name: string } }).customers?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{vehicle.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <LinkButton href={`/vehicles/${vehicle.id}/live`} size="sm" variant="outline">
                      <Radio className="mr-1 h-3 w-3" />
                      Live
                    </LinkButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
