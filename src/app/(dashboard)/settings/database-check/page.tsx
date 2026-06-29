import { format } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/constants/organization";

export const metadata = { title: "Database Check" };

function DataTable({
  title,
  rows,
  columns,
  error,
}: {
  title: string;
  rows: Record<string, unknown>[] | null;
  columns: string[];
  error?: string | null;
}) {
  return (
    <Card className="border border-[#e8f2fa] shadow-sm">
      <CardHeader>
        <CardTitle className="text-base text-[#1C3664]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !rows?.length ? (
          <p className="text-sm text-muted-foreground">No rows found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={String(row.id ?? index)}>
                    {columns.map((col) => (
                      <TableCell key={col} className="font-mono text-xs">
                        {formatCell(row[col])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string" && value.includes("T")) {
    try {
      return format(new Date(value), "dd MMM yyyy HH:mm");
    } catch {
      return value;
    }
  }
  return String(value);
}

export default async function DatabaseCheckPage() {
  const supabase = await createClient();

  const [customersRes, vehiclesRes, devicesRes, vehicleDevicesRes] =
    await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .eq("organization_id", DEFAULT_ORGANIZATION_ID)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("vehicles")
        .select("*")
        .eq("organization_id", DEFAULT_ORGANIZATION_ID)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("devices")
        .select("*")
        .eq("organization_id", DEFAULT_ORGANIZATION_ID)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("vehicle_devices")
        .select("*")
        .order("assigned_at", { ascending: false })
        .limit(5),
    ]);

  if (customersRes.error) console.error("Database check customers:", customersRes.error);
  if (vehiclesRes.error) console.error("Database check vehicles:", vehiclesRes.error);
  if (devicesRes.error) console.error("Database check devices:", devicesRes.error);
  if (vehicleDevicesRes.error) {
    console.error("Database check vehicle_devices:", vehicleDevicesRes.error);
  }

  return (
    <>
      <PageHeader
        title="Database Check"
        description={`Latest rows for organization ${DEFAULT_ORGANIZATION_ID}`}
      />
      <div className="grid gap-6 p-4 md:p-6">
        <DataTable
          title="customers (latest 5)"
          rows={customersRes.data as Record<string, unknown>[] | null}
          columns={[
            "id",
            "full_name",
            "phone",
            "email",
            "city",
            "consent_status",
            "created_at",
          ]}
          error={customersRes.error?.message}
        />
        <DataTable
          title="vehicles (latest 5)"
          rows={vehiclesRes.data as Record<string, unknown>[] | null}
          columns={[
            "id",
            "plate_number",
            "brand",
            "model",
            "year",
            "status",
            "created_at",
          ]}
          error={vehiclesRes.error?.message}
        />
        <DataTable
          title="devices (latest 5)"
          rows={devicesRes.data as Record<string, unknown>[] | null}
          columns={[
            "id",
            "customer_id",
            "serial_number",
            "imei",
            "sim_number",
            "status",
            "activation_date",
            "warranty_end",
            "created_at",
          ]}
          error={devicesRes.error?.message}
        />
        <DataTable
          title="vehicle_devices (latest 5)"
          rows={vehicleDevicesRes.data as Record<string, unknown>[] | null}
          columns={["id", "vehicle_id", "device_id", "assigned_at", "is_active"]}
          error={vehicleDevicesRes.error?.message}
        />
      </div>
    </>
  );
}
