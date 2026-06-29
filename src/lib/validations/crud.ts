import { z } from "zod";

export const customerSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  phone: z.string().optional(),
  whatsapp_number: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email"),
  city: z.string().optional(),
  consent_status: z.enum(["pending", "granted", "declined"]),
  notes: z.string().optional(),
});

export const vehicleSchema = z.object({
  customer_id: z.string().optional(),
  plate_number: z.string().min(1, "Plate number is required"),
  brand: z.string().optional(),
  model: z.string().optional(),
  year: z
    .union([z.coerce.number().min(1990).max(2035), z.literal("")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
  color: z.string().optional(),
  status: z.enum(["active", "inactive", "maintenance"]),
});

export const deviceSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  vehicle_id: z.string().optional(),
  device_model_id: z.string().optional(),
  serial_number: z.string().min(1, "Serial number is required"),
  imei: z.string().optional(),
  sim_number: z.string().optional(),
  status: z.enum(["active", "inactive", "maintenance", "decommissioned"]),
  activation_date: z.string().optional(),
  warranty_start: z.string().optional(),
  warranty_end: z.string().optional(),
});

export type CustomerFormData = z.infer<typeof customerSchema>;
export type VehicleFormData = z.infer<typeof vehicleSchema>;
export type DeviceFormData = z.infer<typeof deviceSchema>;

export function parseFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  const raw = Object.fromEntries(formData.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.issues[0]?.message ?? "Validation failed" };
  }
  return { success: true, data: result.data };
}

export function emptyToNull(value: string | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

export function dateOrNull(value: string | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}
