import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/constants/organization";
import {
  customerDisplayName,
  isWarrantyExpiringSoon,
  matchesSearchTerm,
} from "@/lib/reports/helpers";

export type ReportsFilters = {
  q?: string;
  status?: string;
  type?: string;
  customer_id?: string;
};

export type DeviceOwnershipRow = {
  id: string;
  serial_number: string;
  modelName: string;
  modelCategory: string;
  customerName: string;
  customerPhone: string | null;
  customerWhatsapp: string | null;
  vehiclePlate: string;
  status: string;
  imei: string | null;
  sim_number: string | null;
  warranty_end: string | null;
};

export type VehicleCoverageRow = {
  id: string;
  plate_number: string;
  brand: string | null;
  model: string | null;
  customerName: string;
  devicesCount: number;
  gpsAssigned: boolean;
  dashCamAssigned: boolean;
  status: string;
};

export type CustomerCoverageRow = {
  id: string;
  customerName: string;
  phone: string | null;
  whatsapp_number: string | null;
  city: string | null;
  vehiclesCount: number;
  devicesCount: number;
  latestDeviceSerial: string;
};

export type ReportsSummary = {
  totalCustomers: number;
  totalVehicles: number;
  totalDevices: number;
  assignedDevices: number;
  unassignedDevices: number;
  activeDevices: number;
  gpsDevices: number;
  dashCamDevices: number;
};

export type ReportsHealth = {
  devicesWithoutCustomer: number;
  devicesWithoutVehicle: number;
  vehiclesWithoutDevice: number;
  customersWithoutVehicles: number;
  warrantyExpiringSoon: number;
};

type RawCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  city: string | null;
  created_at: string;
};

type RawVehicle = {
  id: string;
  customer_id: string | null;
  plate_number: string;
  brand: string | null;
  model: string | null;
  status: string;
  customers: { full_name: string } | null;
};

type RawDevice = {
  id: string;
  customer_id: string | null;
  serial_number: string;
  imei: string | null;
  sim_number: string | null;
  status: string;
  warranty_end: string | null;
  created_at: string;
  device_models: { name: string; category: string } | null;
  customers: {
    full_name: string;
    phone: string | null;
    whatsapp_number: string | null;
  } | null;
  vehicle_devices: Array<{
    is_active: boolean;
    vehicles: { plate_number: string } | null;
  }> | null;
};

type RawAssignment = {
  vehicle_id: string;
  device_id: string;
  is_active: boolean;
  devices: {
    serial_number: string;
    device_models: { category: string } | null;
  } | null;
};

export type ReportsData = {
  summary: ReportsSummary;
  health: ReportsHealth;
  deviceOwnership: DeviceOwnershipRow[];
  vehicleCoverage: VehicleCoverageRow[];
  customerCoverage: CustomerCoverageRow[];
  customers: Array<{ id: string; full_name: string }>;
  errors: string[];
  hasCustomers: boolean;
  hasVehicles: boolean;
  hasDevices: boolean;
  hasAssignments: boolean;
};

function getActiveVehiclePlate(device: RawDevice): string | null {
  const active = device.vehicle_devices?.find((row) => row.is_active);
  return active?.vehicles?.plate_number ?? null;
}

function deviceMatchesFilters(
  device: RawDevice,
  filters: ReportsFilters,
  activePlate: string | null
): boolean {
  if (filters.status && device.status !== filters.status) return false;
  if (filters.type && device.device_models?.category !== filters.type) return false;
  if (filters.customer_id && device.customer_id !== filters.customer_id) return false;

  if (filters.q?.trim()) {
    const customer = device.customers;
    return matchesSearchTerm(filters.q, [
      customer?.full_name,
      customer?.phone,
      customer?.whatsapp_number,
      activePlate,
      device.serial_number,
      device.imei,
      device.sim_number,
    ]);
  }

  return true;
}

function vehicleMatchesFilters(
  vehicle: RawVehicle,
  row: VehicleCoverageRow,
  filters: ReportsFilters,
  assignmentSerials: string[],
  assignments: RawAssignment[],
  devices: RawDevice[]
): boolean {
  if (filters.customer_id && vehicle.customer_id !== filters.customer_id) return false;

  if (filters.status || filters.type) {
    const hasMatchingDevice = assignments.some((assignment) => {
      const device = devices.find((item) => item.id === assignment.device_id);
      if (!device) return false;
      if (filters.status && device.status !== filters.status) return false;
      if (filters.type && device.device_models?.category !== filters.type) return false;
      return true;
    });
    if (!hasMatchingDevice) return false;
  }

  if (filters.q?.trim()) {
    return matchesSearchTerm(filters.q, [
      vehicle.plate_number,
      vehicle.brand,
      vehicle.model,
      row.customerName,
      ...assignmentSerials,
    ]);
  }

  return true;
}

function customerMatchesFilters(
  customer: RawCustomer,
  row: CustomerCoverageRow,
  filters: ReportsFilters,
  devices: RawDevice[]
): boolean {
  if (filters.customer_id && customer.id !== filters.customer_id) return false;

  if (filters.status || filters.type) {
    const hasMatchingDevice = devices.some((device) => {
      if (device.customer_id !== customer.id) return false;
      if (filters.status && device.status !== filters.status) return false;
      if (filters.type && device.device_models?.category !== filters.type) return false;
      return true;
    });
    if (!hasMatchingDevice) return false;
  }

  if (filters.q?.trim()) {
    return matchesSearchTerm(filters.q, [
      customer.full_name,
      customer.phone,
      customer.whatsapp_number,
      customer.city,
      customer.email,
      row.latestDeviceSerial !== "—" ? row.latestDeviceSerial : null,
    ]);
  }

  return true;
}

export async function getReportsData(filters: ReportsFilters = {}): Promise<ReportsData> {
  const supabase = await createClient();
  const orgId = DEFAULT_ORGANIZATION_ID;
  const errors: string[] = [];

  const [customersRes, vehiclesRes, devicesRes, assignmentsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, phone, whatsapp_number, email, city, created_at")
      .eq("organization_id", orgId)
      .order("full_name"),
    supabase
      .from("vehicles")
      .select("id, customer_id, plate_number, brand, model, status, customers(full_name)")
      .eq("organization_id", orgId)
      .order("plate_number"),
    supabase
      .from("devices")
      .select(
        `
        id,
        customer_id,
        serial_number,
        imei,
        sim_number,
        status,
        warranty_end,
        created_at,
        device_models(name, category),
        customers(full_name, phone, whatsapp_number),
        vehicle_devices(is_active, vehicles(plate_number))
      `
      )
      .eq("organization_id", orgId)
      .order("serial_number"),
    supabase
      .from("vehicle_devices")
      .select(
        `
        vehicle_id,
        device_id,
        is_active,
        devices(serial_number, device_models(category))
      `
      )
      .eq("is_active", true),
  ]);

  if (customersRes.error) {
    console.error("Reports customers query failed:", customersRes.error);
    errors.push(`Customers: ${customersRes.error.message}`);
  }
  if (vehiclesRes.error) {
    console.error("Reports vehicles query failed:", vehiclesRes.error);
    errors.push(`Vehicles: ${vehiclesRes.error.message}`);
  }
  if (devicesRes.error) {
    console.error("Reports devices query failed:", devicesRes.error);
    errors.push(`Devices: ${devicesRes.error.message}`);
  }
  if (assignmentsRes.error) {
    console.error("Reports assignments query failed:", assignmentsRes.error);
    errors.push(`Assignments: ${assignmentsRes.error.message}`);
  }

  const customers = (customersRes.data ?? []) as RawCustomer[];
  const vehicles = (vehiclesRes.data ?? []) as RawVehicle[];
  const devices = (devicesRes.data ?? []) as RawDevice[];
  const allAssignments = (assignmentsRes.data ?? []) as RawAssignment[];

  const orgDeviceIds = new Set(devices.map((device) => device.id));
  const orgVehicleIds = new Set(vehicles.map((vehicle) => vehicle.id));

  const activeAssignments = allAssignments.filter(
    (row) => orgDeviceIds.has(row.device_id) && orgVehicleIds.has(row.vehicle_id)
  );

  const activeAssignmentDeviceIds = new Set(activeAssignments.map((row) => row.device_id));
  const vehicleIdsWithDevice = new Set(activeAssignments.map((row) => row.vehicle_id));
  const customerIdsWithVehicle = new Set(
    vehicles.filter((vehicle) => vehicle.customer_id).map((vehicle) => vehicle.customer_id as string)
  );

  const assignmentsByVehicle = new Map<string, RawAssignment[]>();
  for (const assignment of activeAssignments) {
    const existing = assignmentsByVehicle.get(assignment.vehicle_id) ?? [];
    existing.push(assignment);
    assignmentsByVehicle.set(assignment.vehicle_id, existing);
  }

  const vehiclesByCustomer = new Map<string, number>();
  for (const vehicle of vehicles) {
    if (!vehicle.customer_id) continue;
    vehiclesByCustomer.set(
      vehicle.customer_id,
      (vehiclesByCustomer.get(vehicle.customer_id) ?? 0) + 1
    );
  }

  const devicesByCustomer = new Map<string, number>();
  const latestDeviceByCustomer = new Map<string, { serial: string; created_at: string }>();
  for (const device of devices) {
    if (!device.customer_id) continue;
    devicesByCustomer.set(
      device.customer_id,
      (devicesByCustomer.get(device.customer_id) ?? 0) + 1
    );
    const current = latestDeviceByCustomer.get(device.customer_id);
    if (!current || device.created_at > current.created_at) {
      latestDeviceByCustomer.set(device.customer_id, {
        serial: device.serial_number,
        created_at: device.created_at,
      });
    }
  }

  const summary: ReportsSummary = {
    totalCustomers: customers.length,
    totalVehicles: vehicles.length,
    totalDevices: devices.length,
    assignedDevices: devices.filter(
      (device) =>
        activeAssignmentDeviceIds.has(device.id) ||
        device.status === "active" ||
        device.status === "assigned"
    ).length,
    unassignedDevices: devices.filter((device) => !activeAssignmentDeviceIds.has(device.id)).length,
    activeDevices: devices.filter((device) => device.status === "active").length,
    gpsDevices: devices.filter((device) => device.device_models?.category === "gps_tracker").length,
    dashCamDevices: devices.filter((device) => device.device_models?.category === "dash_cam").length,
  };

  const health: ReportsHealth = {
    devicesWithoutCustomer: devices.filter((device) => !device.customer_id).length,
    devicesWithoutVehicle: devices.filter((device) => !activeAssignmentDeviceIds.has(device.id)).length,
    vehiclesWithoutDevice: vehicles.filter((vehicle) => !vehicleIdsWithDevice.has(vehicle.id)).length,
    customersWithoutVehicles: customers.filter((customer) => !customerIdsWithVehicle.has(customer.id))
      .length,
    warrantyExpiringSoon: devices.filter((device) => isWarrantyExpiringSoon(device.warranty_end)).length,
  };

  const deviceOwnershipAll: DeviceOwnershipRow[] = devices.map((device) => {
    const activePlate = getActiveVehiclePlate(device);
    return {
      id: device.id,
      serial_number: device.serial_number,
      modelName: device.device_models?.name ?? "—",
      modelCategory: device.device_models?.category ?? "—",
      customerName: device.customers
        ? customerDisplayName(device.customers.full_name)
        : "No customer",
      customerPhone: device.customers?.phone ?? null,
      customerWhatsapp: device.customers?.whatsapp_number ?? null,
      vehiclePlate: activePlate ?? "Not assigned",
      status: device.status,
      imei: device.imei,
      sim_number: device.sim_number,
      warranty_end: device.warranty_end,
    };
  });

  const vehicleCoverageAll: VehicleCoverageRow[] = vehicles.map((vehicle) => {
    const assignments = assignmentsByVehicle.get(vehicle.id) ?? [];
    const categories = assignments
      .map((row) => row.devices?.device_models?.category)
      .filter(Boolean) as string[];

    return {
      id: vehicle.id,
      plate_number: vehicle.plate_number,
      brand: vehicle.brand,
      model: vehicle.model,
      customerName: vehicle.customers
        ? customerDisplayName(vehicle.customers.full_name)
        : "No customer",
      devicesCount: assignments.length,
      gpsAssigned: categories.includes("gps_tracker"),
      dashCamAssigned: categories.includes("dash_cam"),
      status: vehicle.status,
    };
  });

  const customerCoverageAll: CustomerCoverageRow[] = customers.map((customer) => ({
    id: customer.id,
    customerName: customerDisplayName(customer.full_name),
    phone: customer.phone,
    whatsapp_number: customer.whatsapp_number,
    city: customer.city,
    vehiclesCount: vehiclesByCustomer.get(customer.id) ?? 0,
    devicesCount: devicesByCustomer.get(customer.id) ?? 0,
    latestDeviceSerial: latestDeviceByCustomer.get(customer.id)?.serial ?? "—",
  }));

  const deviceOwnership = deviceOwnershipAll.filter((row, index) =>
    deviceMatchesFilters(devices[index], filters, getActiveVehiclePlate(devices[index]))
  );

  const vehicleCoverage = vehicleCoverageAll.filter((row, index) => {
    const assignments = assignmentsByVehicle.get(vehicles[index].id) ?? [];
    const serials = assignments
      .map((assignment) => assignment.devices?.serial_number)
      .filter(Boolean) as string[];
    return vehicleMatchesFilters(
      vehicles[index],
      row,
      filters,
      serials,
      assignments,
      devices
    );
  });

  const customerCoverage = customerCoverageAll.filter((row, index) =>
    customerMatchesFilters(customers[index], row, filters, devices)
  );

  return {
    summary,
    health,
    deviceOwnership,
    vehicleCoverage,
    customerCoverage,
    customers: customers.map((customer) => ({
      id: customer.id,
      full_name: customerDisplayName(customer.full_name),
    })),
    errors,
    hasCustomers: customers.length > 0,
    hasVehicles: vehicles.length > 0,
    hasDevices: devices.length > 0,
    hasAssignments: activeAssignments.length > 0,
  };
}
