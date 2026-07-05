import { NextResponse } from "next/server";
import { z } from "zod";
import { getJtApiContext, JT_MSG } from "@/lib/jt/api-context";
import { enqueueCommand } from "@/lib/jt/commands";

const bodySchema = z.object({
  logical_channel: z.number().int().min(1).max(255).default(1),
  stream_type: z.enum(["main", "sub"]).default("sub"),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ terminalId: string }> },
) {
  const { terminalId } = await params;
  const { supabase, organizationId } = await getJtApiContext();

  const { data: terminal } = await supabase
    .from("jt_terminals")
    .select("id")
    .eq("id", terminalId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!terminal) {
    return NextResponse.json({ error: "Terminal not found" }, { status: 404 });
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const commandId = await enqueueCommand(supabase, {
    organizationId,
    terminalId,
    commandName: "query_recording_resources",
    messageId: JT_MSG.QUERY_RECORDING_RESOURCES,
    payload: {
      logical_channel: parsed.data.logical_channel,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
    },
  });

  return NextResponse.json({ commandId });
}
