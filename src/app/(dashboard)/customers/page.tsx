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

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Customers" description="Manage fleet customer accounts">
        <LinkButton href="/customers/new" className="bg-[#1C3664] hover:bg-[#1C3664]/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </LinkButton>
      </PageHeader>
      <div className="p-4 md:p-6">
        <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No customers found
                  </TableCell>
                </TableRow>
              )}
              {customers?.map((customer) => (
                <TableRow key={customer.id} className="cursor-pointer hover:bg-[#F2F8FC]">
                  <TableCell>
                    <Link href={`/customers/${customer.id}`} className="font-medium text-[#1C3664]">
                      {customer.name}
                    </Link>
                  </TableCell>
                  <TableCell>{customer.contact_name ?? "—"}</TableCell>
                  <TableCell>{customer.phone ?? "—"}</TableCell>
                  <TableCell>{customer.city ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={customer.is_active ? "default" : "secondary"}>
                      {customer.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(customer.created_at), "dd MMM yyyy")}
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
