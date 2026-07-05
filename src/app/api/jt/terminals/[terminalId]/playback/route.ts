import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTerminalAccess, JT_MSG } from "@/lib/jt/api-context";
import { createLiveStreamSession, enqueueCommand } from "@/lib/jt/commands";

const bodySchema = z.object({
  logical_channel: z.number().int().min(1).max(255).default(1),
  stream_type: z.enum(["main", "sub"]).default("sub"),
  start_time: z.string(),
  end_time: z.string(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ terminalId: string }> },
) {
  const { terminalId } = await params;
  const access = await requireTerminalAccess(terminalId);
  if ("error" in access) return access.error;

  const json = await req.json();
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
    dataType: "video",
  });

  await access.supabase
    .from("jt_stream_sessions")
    .update({
      mode: "playback",
      playback_start: parsed.data.start_time,
      playback_end: parsed.data.end_time,
    })
    .eq("id", stream.id);

  const commandId = await enqueueCommand(access.supabase, {
    organizationId: access.organizationId,
    terminalId,
    commandName: "start_playback",
    messageId: JT_MSG.START_REMOTE_PLAYBACK,
    streamSessionId: stream.id,
    payload: parsed.data,
  });

  return NextResponse.json({ streamSessionId: stream.id, commandId });
}
