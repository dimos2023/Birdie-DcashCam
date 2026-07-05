import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTerminalAccess, JT_MSG } from "@/lib/jt/api-context";
import { createLiveStreamSession, enqueueCommand } from "@/lib/jt/commands";

const bodySchema = z.object({
  logical_channel: z.number().int().min(1).max(255).default(1),
  stream_type: z.enum(["main", "sub"]).default("sub"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ terminalId: string }> },
) {
  const { terminalId } = await params;
  const access = await requireTerminalAccess(terminalId);
  if ("error" in access) return access.error;

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const stream = await createLiveStreamSession(access.supabase, {
    organizationId: access.organizationId,
    terminalId,
    vehicleId: access.terminal.vehicle_id,
    logicalChannel: parsed.data.logical_channel,
    streamType: parsed.data.stream_type,
  });

  const commandId = await enqueueCommand(access.supabase, {
    organizationId: access.organizationId,
    terminalId,
    commandName: "start_live",
    messageId: JT_MSG.START_REALTIME_AV,
    streamSessionId: stream.id,
    payload: {
      logical_channel: parsed.data.logical_channel,
      stream_type: parsed.data.stream_type,
    },
  });

  await access.supabase
    .from("jt_stream_sessions")
    .update({ request_command_id: commandId })
    .eq("id", stream.id);

  return NextResponse.json({
    streamSessionId: stream.id,
    sessionKey: stream.session_key,
    commandId,
  });
}
