"use server";

import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AuditAction, Json } from "@/lib/types";

export async function logAuditEvent(params: {
  organizationId: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Json;
}) {
  const supabase = await createClient();

  await supabase.from("audit_logs").insert({
    organization_id: params.organizationId,
    user_id: params.userId ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
}
