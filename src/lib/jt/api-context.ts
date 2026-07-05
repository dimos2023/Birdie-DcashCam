import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActionContext } from "@/lib/actions/context";

export async function getJtApiContext() {
  const supabase = await createClient();
  const ctx = await getActionContext();
  return { supabase, ...ctx };
}

export async function requireTerminalAccess(terminalId: string) {
  const { supabase, organizationId } = await getJtApiContext();
  const { data: terminal, error } = await supabase
    .from("jt_terminals")
    .select("*")
    .eq("id", terminalId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !terminal) {
    return {
      error: NextResponse.json({ error: "Terminal not found" }, { status: 404 }),
    };
  }

  return { supabase, organizationId, terminal };
}

export const JT_MSG = {
  QUERY_AV_ATTRIBUTES: 0x9003,
  QUERY_LOCATION: 0x8201,
  START_REALTIME_AV: 0x9101,
  CONTROL_REALTIME_AV: 0x9102,
  QUERY_RECORDING_RESOURCES: 0x9205,
  START_REMOTE_PLAYBACK: 0x9201,
  PLAYBACK_CONTROL: 0x9202,
} as const;
