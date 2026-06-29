"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActionContext } from "@/lib/actions/context";
import { logAuditEvent } from "@/lib/auth/audit";
import {
  customerSchema,
  parseFormData,
  emptyToNull,
} from "@/lib/validations/crud";
import type { DeleteResult } from "@/lib/actions/types";

export async function createCustomer(formData: FormData) {
  const ctx = await getActionContext();
  const parsed = parseFormData(customerSchema, formData);

  if (!parsed.success) {
    redirect(`/customers/new?error=${encodeURIComponent(parsed.error)}`);
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("customers")
    .insert({
      organization_id: ctx.organizationId,
      name: data.full_name,
      phone: emptyToNull(data.phone),
      whatsapp_number: emptyToNull(data.whatsapp_number),
      email: emptyToNull(data.email),
      city: emptyToNull(data.city),
      consent_status: data.consent_status,
      notes: emptyToNull(data.notes),
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/customers/new?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId ?? undefined,
    action: "create",
    entityType: "customer",
    entityId: row.id,
  });

  revalidatePath("/customers");
  redirect(`/customers/${row.id}`);
}

export async function updateCustomer(id: string, formData: FormData) {
  const ctx = await getActionContext();
  const parsed = parseFormData(customerSchema, formData);

  if (!parsed.success) {
    redirect(`/customers/${id}/edit?error=${encodeURIComponent(parsed.error)}`);
  }

  const data = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("customers")
    .update({
      name: data.full_name,
      phone: emptyToNull(data.phone),
      whatsapp_number: emptyToNull(data.whatsapp_number),
      email: emptyToNull(data.email),
      city: emptyToNull(data.city),
      consent_status: data.consent_status,
      notes: emptyToNull(data.notes),
    })
    .eq("id", id);

  if (error) {
    redirect(`/customers/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId ?? undefined,
    action: "update",
    entityType: "customer",
    entityId: id,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(id: string): Promise<DeleteResult> {
  const ctx = await getActionContext();
  const supabase = await createClient();

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  await logAuditEvent({
    organizationId: ctx.organizationId,
    userId: ctx.userId ?? undefined,
    action: "delete",
    entityType: "customer",
    entityId: id,
  });

  revalidatePath("/customers");
  return { success: true };
}
