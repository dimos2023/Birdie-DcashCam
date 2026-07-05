import { NextResponse } from "next/server";
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
    commandName: "query_location",
    messageId: JT_MSG.QUERY_LOCATION,
  });

  return NextResponse.json({ commandId });
}
