import { Suspense } from "react";
import { format } from "date-fns";
import { Eye, Pencil, Plus, Users } from "lucide-react";
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
import { deleteCustomer } from "@/app/(dashboard)/customers/actions";

export const metadata = { title: "Customers" };

function consentBadge(status: string) {
  if (status === "granted") return "default" as const;
  if (status === "declined") return "destructive" as const;
  return "secondary" as const;
}

function displayName(name: string | null | undefined) {
  return name?.trim() ? name : "Unnamed Customer";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("customers").select("*").order("created_at", { ascending: false });

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(
      `full_name.ilike.${term},phone.ilike.${term},email.ilike.${term},city.ilike.${term},whatsapp_number.ilike.${term}`
    );
  }

  const { data: customers } = await query;

  return (
    <>
      <PageHeader title="Customers" description="Manage fleet customer accounts">
        <LinkButton href="/customers/new" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </LinkButton>
      </PageHeader>
      <div className="space-y-4 p-4 md:p-6">
        <Suspense fallback={null}>
          <EntitySearch placeholder="Search by name, phone, email, city..." />
        </Suspense>

        <div className="overflow-hidden rounded-xl border border-[#e8f2fa] bg-white shadow-sm">
          {!customers?.length ? (
            <ListEmptyState
              icon={Users}
              title={q ? "No customers match your search" : "No customers yet"}
              description={
                q
                  ? "Try a different search term or clear the filter."
                  : "Add your first customer to start assigning vehicles and devices."
              }
              actionLabel="Add Customer"
              actionHref="/customers/new"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Consent</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id} className="hover:bg-[#F2F8FC]/60">
                      <TableCell className="font-medium text-[#1C3664]">
                        {displayName(customer.full_name)}
                      </TableCell>
                      <TableCell>{customer.phone ?? "—"}</TableCell>
                      <TableCell>{customer.whatsapp_number ?? "—"}</TableCell>
                      <TableCell>{customer.email ?? "—"}</TableCell>
                      <TableCell>{customer.city ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={consentBadge(customer.consent_status ?? "pending")}>
                          {customer.consent_status ?? "pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(customer.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <LinkButton href={`/customers/${customer.id}`} size="sm" variant="ghost">
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            View
                          </LinkButton>
                          <LinkButton
                            href={`/customers/${customer.id}/edit`}
                            size="sm"
                            variant="outline"
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </LinkButton>
                          <DeleteConfirmButton
                            id={customer.id}
                            confirmMessage="Are you sure you want to delete this customer?"
                            deleteAction={deleteCustomer}
                            redirectTo="/customers"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
