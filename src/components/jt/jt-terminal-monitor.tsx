"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JtTerminalLive } from "@/lib/types";

interface Props {
  initialTerminals: JtTerminalLive[];
  organizationId: string;
}

export function JtTerminalMonitor({ initialTerminals, organizationId }: Props) {
  const [terminals, setTerminals] = useState(initialTerminals);
  const [streams, setStreams] = useState<Record<string, { id: string; status: string; playback_url: string | null }>>({});
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`jt-live-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jt_terminals", filter: `organization_id=eq.${organizationId}` },
        () => refreshTerminals(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jt_latest_positions", filter: `organization_id=eq.${organizationId}` },
        () => refreshTerminals(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jt_stream_sessions", filter: `organization_id=eq.${organizationId}` },
        () => refreshStreams(),
      )
      .subscribe();

    void refreshStreams();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const refreshTerminals = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("jt_terminal_live").select("*").eq("organization_id", organizationId);
    if (data) setTerminals(data as JtTerminalLive[]);
  }, [organizationId]);

  const refreshStreams = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("jt_stream_sessions")
      .select("id, terminal_id, status, playback_url")
      .eq("organization_id", organizationId)
      .in("status", ["requested", "command_sent", "connecting", "active"]);
    if (data) {
      const map: Record<string, { id: string; status: string; playback_url: string | null }> = {};
      for (const row of data) {
        map[row.terminal_id] = row;
      }
      setStreams(map);
    }
  }, [organizationId]);

  async function startLive(terminalId: string, streamType: "main" | "sub") {
    setLoading(terminalId);
    try {
      await fetch(`/api/jt/terminals/${terminalId}/live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logical_channel: 1, stream_type: streamType }),
      });
      await refreshStreams();
    } finally {
      setLoading(null);
    }
  }

  async function stopLive(streamId: string) {
    setLoading(streamId);
    try {
      await fetch(`/api/jt/streams/${streamId}/stop`, { method: "POST" });
      await refreshStreams();
    } finally {
      setLoading(null);
    }
  }

  if (terminals.length === 0) {
    return (
      <Card className="col-span-full border-0 shadow-sm">
        <CardContent className="py-8 text-center text-muted-foreground">
          No direct JT terminals provisioned. Link a terminal on the device edit page.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {terminals.map((t) => {
        const stream = streams[t.terminal_id];
        return (
          <Card key={t.terminal_id} className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-[#1C3664]">
                  {t.display_name || t.terminal_no}
                </CardTitle>
                <Badge variant={t.is_online ? "default" : "secondary"}>
                  {t.is_online ? "Online" : "Offline"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t.plate_number || "—"} · {t.registration_state}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Speed</dt>
                  <dd>{t.speed_kmh != null ? `${t.speed_kmh} km/h` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ACC</dt>
                  <dd>{t.acc_on == null ? "—" : t.acc_on ? "On" : "Off"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Signal</dt>
                  <dd>{t.signal_strength ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Satellites</dt>
                  <dd>{t.satellite_count ?? "—"}</dd>
                </div>
              </dl>
              {t.latitude != null && t.longitude != null && (
                <p className="text-xs text-muted-foreground">
                  {t.latitude.toFixed(5)}, {t.longitude.toFixed(5)}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!t.is_online || loading === t.terminal_id}
                  onClick={() => startLive(t.terminal_id, "sub")}
                  className="bg-[#3B8ECC] hover:bg-[#3B8ECC]/90"
                >
                  Start Sub Stream
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!t.is_online || loading === t.terminal_id}
                  onClick={() => startLive(t.terminal_id, "main")}
                >
                  Main Stream
                </Button>
                {stream && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={loading === stream.id}
                    onClick={() => stopLive(stream.id)}
                  >
                    Stop
                  </Button>
                )}
              </div>
              {stream?.status === "active" && stream.playback_url && (
                <video
                  className="aspect-video w-full rounded-md bg-black"
                  src={stream.playback_url}
                  controls
                  autoPlay
                  muted
                  playsInline
                />
              )}
              {stream && stream.status !== "active" && (
                <p className="text-xs text-amber-700">Stream: {stream.status}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
