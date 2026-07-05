import { NextResponse } from "next/server";
import { getJtApiContext, JT_MSG } from "@/lib/jt/api-context";
import { enqueueCommand } from "@/lib/jt/commands";

async function streamControl(
  streamId: string,
  control: "stop" | "pause" | "resume",
) {
  const { supabase, organizationId } = await getJtApiContext();

  const { data: stream, error } = await supabase
    .from("jt_stream_sessions")
    .select("*")
    .eq("id", streamId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !stream) {
    return NextResponse.json({ error: "Stream session not found" }, { status: 404 });
  }

  const commandId = await enqueueCommand(supabase, {
    organizationId,
    terminalId: stream.terminal_id,
    commandName: `${control}_stream`,
    messageId: JT_MSG.CONTROL_REALTIME_AV,
    streamSessionId: streamId,
    payload: {
      logical_channel: stream.logical_channel,
      stream_type: stream.stream_type,
      control,
    },
  });

  if (control === "stop") {
    await supabase
      .from("jt_stream_sessions")
      .update({ status: "stopping", stop_command_id: commandId })
      .eq("id", streamId);
  }

  return NextResponse.json({ commandId, streamSessionId: streamId });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ streamId: string }> },
) {
  const { streamId } = await params;
  return streamControl(streamId, "stop");
}
