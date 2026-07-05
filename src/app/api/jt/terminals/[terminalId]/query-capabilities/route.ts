import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTerminalAccess, JT_MSG } from "@/lib/jt/api-context";
import { enqueueCommand } from "@/lib/jt/commands";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ terminalId: string }> },
) {
  const { terminalId } = await params;
  const access = await requireTerminalAccess(terminalId);
  if ("error" in access) return access.error;

  const commandId = await enqueueCommand(access.supabase, {
    organizationId: access.organizationId,
    terminalId,
    commandName: "query_av_attributes",
    messageId: JT_MSG.QUERY_AV_ATTRIBUTES,
    createdBy: null,
  });

  return NextResponse.json({ commandId });
}
