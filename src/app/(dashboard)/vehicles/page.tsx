import { Suspense } from "react";
import { format } from "date-fns";
import { Car, Eye, Pencil, Plus, Radio } from "lucide-react";
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
import { deleteVehicle } from "@/app/(dashboard)/vehicles/actions";

export const metadata = { title: "Vehicles" };

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select("*, customers(name)")
    .order("created_at", { ascending: false });

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `plate_number.ilike.${term},make.ilike.${term},model.ilike.${term},color.ilike.${term}`
    );
  }

  const { data: vehicles } = await query;

  return (
    <>
      <PageHeader title="Vehicles" description="Monitor and manage fleet vehicles">
        <LinkButton href="/vehicles/new" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </LinkButton>
      </PageHeader>
      <div className="space-y-4 p-4 md:p-6">
        <Suspense fallback={null}>
          <EntitySearch placeholder="Search by plate, brand, model, color..." />
        </Suspense>

        <div className="overflow-hidden rounded-xl border border-[#e8f2fa] bg-white shadow-sm">
          {!vehicles?.length ? (
            <ListEmptyState
              icon={Car}
              title={q ? "No vehicles match your search" : "No vehicles registered"}
              description={
                q
                  ? "Try a different search term or clear the filter."
                  : "Register fleet vehicles to enable GPS tracking and live monitoring."
              }
              actionLabel="Add Vehicle"
              actionHref="/vehicles/new"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Plate Number</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle) => {
                    const customer = (vehicle as { customers?: { name: string } }).customers;
                    return (
                      <TableRow key={vehicle.id} className="hover:bg-[#F2F8FC]/60">
                        <TableCell className="font-semibold text-[#1C3664]">
                          {vehicle.plate_number}
                        </TableCell>
                        <TableCell>{vehicle.make ?? "—"}</TableCell>
                        <TableCell>{vehicle.model ?? "—"}</TableCell>
                        <TableCell>{vehicle.year ?? "—"}</TableCell>
                        <TableCell>{customer?.name ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{vehicle.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(vehicle.created_at), "dd MMM yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <LinkButton href={`/vehicles/${vehicle.id}`} size="sm" variant="ghost">
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              View
                            </LinkButton>
                            <LinkButton
                              href={`/vehicles/${vehicle.id}/edit`}
                              size="sm"
                              variant="outline"
                            >
                              <Pencil className="mr-1 h-3.5 w-3.5" />
                              Edit
                            </LinkButton>
                            <LinkButton
                              href={`/vehicles/${vehicle.id}/live`}
                              size="sm"
                              className="bg-[#3B8ECC] hover:bg-[#3B8ECC]/90"
                            >
                              <Radio className="mr-1 h-3.5 w-3.5" />
                              Live
                            </LinkButton>
                            <DeleteConfirmButton
                              id={vehicle.id}
                              confirmMessage="Are you sure you want to delete this vehicle?"
                              deleteAction={deleteVehicle}
                              redirectTo="/vehicles"
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
