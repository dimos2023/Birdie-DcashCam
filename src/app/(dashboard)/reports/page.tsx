import { Suspense } from "react";
import {
  Car,
  Cpu,
  Link2,
  MapPin,
  Radio,
  ShieldAlert,
  Unlink,
  Users,
  Video,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { ReportsActions } from "@/components/reports/reports-actions";
import { ReportsFilters } from "@/components/reports/reports-filters";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getReportsData } from "@/lib/reports/queries";
import {
  buildCsvData,
  formatDate,
  safeText,
  statusBadgeVariant,
} from "@/lib/reports/helpers";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reports" };

function HealthInsight({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  const hasIssue = count > 0;

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        hasIssue
          ? "border-amber-200 bg-amber-50/80"
          : "border-[#e8f2fa] bg-[#F2F8FC]/60"
      )}
    >
      <p className="text-sm text-[#1C1C1C]/70">{label}</p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold",
          hasIssue ? "text-amber-700" : "text-emerald-600"
        )}
      >
        {hasIssue ? count : "No issues found"}
      </p>
    </div>
  );
}

function TableEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#d4e4f0] bg-[#F2F8FC]/40 px-6 py-10 text-center">
      <p className="text-sm font-medium text-[#1C3664]">{message}</p>
    </div>
  );
}

function yesNoBadge(value: boolean) {
  return (
    <Badge variant={value ? "default" : "outline"}>{value ? "Yes" : "No"}</Badge>
  );
}

function categoryLabel(category: string): string {
  if (category === "—") return "—";
  return category.replace(/_/g, " ");
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    customer_id?: string;
  }>;
}) {
  const params = await searchParams;
  const filters = {
    q: params.q,
    status: params.status,
    type: params.type,
    customer_id: params.customer_id,
  };
  const hasActiveFilters = Boolean(
    filters.q || filters.status || filters.type || filters.customer_id
  );

  const data = await getReportsData(filters);

  const csvContent = buildCsvData({
    deviceOwnership: [
      [
        "Serial Number",
        "Device Model",
        "Device Type",
        "Customer",
        "Vehicle",
        "Status",
        "IMEI",
        "SIM",
        "Warranty End",
      ],
      ...data.deviceOwnership.map((row) => [
        row.serial_number,
        row.modelName,
        categoryLabel(row.modelCategory),
        row.customerName,
        row.vehiclePlate,
        row.status,
        safeText(row.imei, ""),
        safeText(row.sim_number, ""),
        formatDate(row.warranty_end),
      ]),
    ],
    vehicleCoverage: [
      [
        "Plate Number",
        "Brand",
        "Model",
        "Customer",
        "Devices Count",
        "GPS Assigned",
        "Dash Cam Assigned",
        "Status",
      ],
      ...data.vehicleCoverage.map((row) => [
        row.plate_number,
        safeText(row.brand, ""),
        safeText(row.model, ""),
        row.customerName,
        String(row.devicesCount),
        row.gpsAssigned ? "Yes" : "No",
        row.dashCamAssigned ? "Yes" : "No",
        row.status,
      ]),
    ],
    customerCoverage: [
      ["Customer", "Phone", "WhatsApp", "City", "Vehicles Count", "Devices Count", "Latest Device"],
      ...data.customerCoverage.map((row) => [
        row.customerName,
        safeText(row.phone, ""),
        safeText(row.whatsapp_number, ""),
        safeText(row.city, ""),
        String(row.vehiclesCount),
        String(row.devicesCount),
        row.latestDeviceSerial,
      ]),
    ],
  });

  return (
    <>
      <PageHeader
        title="Reports"
        description="Concise operational overview for customers, vehicles, devices, and assignments."
      >
        <ReportsActions csvContent={csvContent} />
      </PageHeader>

      <div id="report-print-area" className="space-y-6 p-4 md:p-6">
        {data.errors.length > 0 && (
          <div className="space-y-2 print:hidden">
            {data.errors.map((message) => (
              <Alert key={message} variant="destructive">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <Suspense fallback={null}>
          <ReportsFilters customers={data.customers} />
        </Suspense>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Customers" value={data.summary.totalCustomers} icon={Users} />
          <StatCard title="Total Vehicles" value={data.summary.totalVehicles} icon={Car} />
          <StatCard title="Total Devices" value={data.summary.totalDevices} icon={Cpu} />
          <StatCard
            title="Assigned Devices"
            value={data.summary.assignedDevices}
            icon={Link2}
            description="Active vehicle assignment or active status"
          />
          <StatCard
            title="Unassigned Devices"
            value={data.summary.unassignedDevices}
            icon={Unlink}
            description="No active vehicle assignment"
          />
          <StatCard title="Active Devices" value={data.summary.activeDevices} icon={Radio} />
          <StatCard title="GPS Devices" value={data.summary.gpsDevices} icon={MapPin} />
          <StatCard title="Dash Cam Devices" value={data.summary.dashCamDevices} icon={Video} />
        </section>

        <DashboardSection title="Operational Health">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <HealthInsight label="Devices Without Customer" count={data.health.devicesWithoutCustomer} />
            <HealthInsight label="Devices Without Vehicle" count={data.health.devicesWithoutVehicle} />
            <HealthInsight label="Vehicles Without Device" count={data.health.vehiclesWithoutDevice} />
            <HealthInsight
              label="Customers Without Vehicles"
              count={data.health.customersWithoutVehicles}
            />
            <HealthInsight label="Warranty Expiring Soon" count={data.health.warrantyExpiringSoon} />
          </div>
          {!data.hasAssignments && data.hasDevices && (
            <p className="mt-4 text-sm text-muted-foreground">No assignments found.</p>
          )}
        </DashboardSection>

        <DashboardSection title="Device Ownership Report">
          {!data.hasDevices ? (
            <TableEmptyState message="No devices found" />
          ) : data.deviceOwnership.length === 0 ? (
            <TableEmptyState
              message={
                hasActiveFilters
                  ? "No devices match the current filters"
                  : "No devices found"
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e8f2fa]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Device Model</TableHead>
                    <TableHead>Device Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>IMEI</TableHead>
                    <TableHead>SIM</TableHead>
                    <TableHead>Warranty End</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.deviceOwnership.map((row) => (
                    <TableRow key={row.id} className="hover:bg-[#F2F8FC]/60">
                      <TableCell className="font-mono font-medium text-[#1C3664]">
                        {row.serial_number}
                      </TableCell>
                      <TableCell>{row.modelName}</TableCell>
                      <TableCell className="capitalize">{categoryLabel(row.modelCategory)}</TableCell>
                      <TableCell>{row.customerName}</TableCell>
                      <TableCell>{row.vehiclePlate}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{safeText(row.imei)}</TableCell>
                      <TableCell>{safeText(row.sim_number)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(row.warranty_end)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DashboardSection>

        <DashboardSection title="Vehicle Coverage Report">
          {!data.hasVehicles ? (
            <TableEmptyState message="No vehicles found" />
          ) : data.vehicleCoverage.length === 0 ? (
            <TableEmptyState
              message={
                hasActiveFilters
                  ? "No vehicles match the current filters"
                  : "No vehicles found"
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e8f2fa]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Plate Number</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Devices Count</TableHead>
                    <TableHead>GPS Assigned</TableHead>
                    <TableHead>Dash Cam Assigned</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vehicleCoverage.map((row) => (
                    <TableRow key={row.id} className="hover:bg-[#F2F8FC]/60">
                      <TableCell className="font-medium text-[#1C3664]">{row.plate_number}</TableCell>
                      <TableCell>{safeText(row.brand)}</TableCell>
                      <TableCell>{safeText(row.model)}</TableCell>
                      <TableCell>{row.customerName}</TableCell>
                      <TableCell>{row.devicesCount}</TableCell>
                      <TableCell>{yesNoBadge(row.gpsAssigned)}</TableCell>
                      <TableCell>{yesNoBadge(row.dashCamAssigned)}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DashboardSection>

        <DashboardSection title="Customer Coverage Report">
          {!data.hasCustomers ? (
            <TableEmptyState message="No customers found" />
          ) : data.customerCoverage.length === 0 ? (
            <TableEmptyState
              message={
                hasActiveFilters
                  ? "No customers match the current filters"
                  : "No customers found"
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e8f2fa]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Vehicles Count</TableHead>
                    <TableHead>Devices Count</TableHead>
                    <TableHead>Latest Device</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customerCoverage.map((row) => (
                    <TableRow key={row.id} className="hover:bg-[#F2F8FC]/60">
                      <TableCell className="font-medium text-[#1C3664]">{row.customerName}</TableCell>
                      <TableCell>{safeText(row.phone)}</TableCell>
                      <TableCell>{safeText(row.whatsapp_number)}</TableCell>
                      <TableCell>{safeText(row.city)}</TableCell>
                      <TableCell>{row.vehiclesCount}</TableCell>
                      <TableCell>{row.devicesCount}</TableCell>
                      <TableCell className="font-mono text-sm">{row.latestDeviceSerial}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DashboardSection>

        {!data.hasCustomers && !data.hasVehicles && !data.hasDevices && (
          <Alert className="border-[#e8f2fa] bg-[#F2F8FC]/60">
            <ShieldAlert className="h-4 w-4 text-[#1C3664]" />
            <AlertDescription>
              Your fleet database is empty. Add customers, vehicles, and devices to populate this
              report.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}
