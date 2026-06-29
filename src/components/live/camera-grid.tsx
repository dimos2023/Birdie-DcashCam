"use client";

import { useState } from "react";
import {
  Camera,
  Maximize2,
  Radio,
  Video,
  Volume2,
  VolumeX,
  Image,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CameraStream } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DeviceType = "dash_cam" | "gps_tracker" | "combo" | null;

const CHANNELS_BY_TYPE: Record<string, string[]> = {
  dash_cam: ["Front", "Rear"],
  combo: ["Front", "Rear", "Cabin"],
  default: ["Front", "Rear"],
};

function getChannelNames(deviceType: DeviceType): string[] {
  if (deviceType === "gps_tracker") return [];
  return CHANNELS_BY_TYPE[deviceType ?? "default"] ?? CHANNELS_BY_TYPE.default;
}

function placeholderStreamUrl(vehicleId: string, channel: string): string {
  const slug = channel.toLowerCase().replace(/\s+/g, "-");
  return `https://stream.birdie.sa/hls/${vehicleId}/${slug}/index.m3u8`;
}

interface CameraStreamCardProps {
  stream: CameraStream;
  vehicleId: string;
}

function CameraStreamCard({ stream, vehicleId }: CameraStreamCardProps) {
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const streamUrl =
    stream.stream_url ?? placeholderStreamUrl(vehicleId, stream.channel_name);

  const handleSnapshot = () => {
    toast.success(`Snapshot captured — ${stream.channel_name}`, {
      description: "Snapshot storage will be available in production.",
    });
  };

  return (
    <>
      <Card className="overflow-hidden border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 bg-[#1C3664] pb-2 text-white">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">{stream.channel_name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={stream.is_live ? "default" : "secondary"}
              className={cn("text-xs", stream.is_live ? "bg-red-500 hover:bg-red-500" : "")}
            >
              {stream.is_live ? (
                <>
                  <Radio className="mr-1 h-3 w-3 animate-pulse" />
                  LIVE
                </>
              ) : (
                "OFFLINE"
              )}
            </Badge>
            <Badge variant="outline" className="border-white/30 text-xs text-white">
              {stream.stream_type.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative flex aspect-video items-center justify-center bg-[#1C1C1C]">
            {stream.is_live ? (
              <div className="flex flex-col items-center gap-2 px-4 text-center text-white/60">
                <Video className="h-10 w-10 md:h-12 md:w-12" />
                <p className="text-sm">Stream ready</p>
                <p className="max-w-[240px] truncate font-mono text-[10px] text-white/40">
                  {streamUrl}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/40">
                <Camera className="h-10 w-10" />
                <p className="text-sm">Camera offline</p>
              </div>
            )}

            <div className="absolute right-2 bottom-2 flex gap-1">
              <Button
                size="icon-sm"
                variant="secondary"
                className="bg-black/50 text-white hover:bg-black/70"
                onClick={() => setMuted(!muted)}
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                className="bg-black/50 text-white hover:bg-black/70"
                onClick={handleSnapshot}
                aria-label="Take snapshot"
              >
                <Image className="h-4 w-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                className="bg-black/50 text-white hover:bg-black/70"
                onClick={() => setFullscreen(true)}
                aria-label="Fullscreen"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-4xl border-0 p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="text-[#1C3664]">
              {stream.channel_name} — Fullscreen
            </DialogTitle>
          </DialogHeader>
          <div className="flex aspect-video items-center justify-center bg-[#1C1C1C]">
            <div className="text-center text-white/60">
              <Video className="mx-auto h-16 w-16" />
              <p className="mt-3 text-sm">HLS / WebRTC player placeholder</p>
              <p className="mt-1 font-mono text-xs text-white/40">{streamUrl}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface CameraGridProps {
  vehicleId: string;
  streams: CameraStream[];
  deviceType?: DeviceType;
}

export function CameraGrid({ vehicleId, streams, deviceType }: CameraGridProps) {
  const channelNames = getChannelNames(deviceType ?? null);

  if (channelNames.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
        <Camera className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 font-medium text-[#1C3664]">No cameras on this device</p>
        <p className="mt-1 text-sm text-muted-foreground">
          GPS-only trackers do not include video channels.
        </p>
      </div>
    );
  }

  const items: CameraStream[] = channelNames.map((channel) => {
    const existing = streams.find(
      (s) => s.channel_name.toLowerCase() === channel.toLowerCase()
    );
    if (existing) return existing;

    return {
      id: `placeholder-${channel}`,
      organization_id: "",
      vehicle_id: vehicleId,
      device_id: null,
      channel_name: channel,
      stream_type: "hls",
      stream_url: placeholderStreamUrl(vehicleId, channel),
      webrtc_signaling_url: null,
      is_live: deviceType !== null,
      thumbnail_url: null,
      created_at: "",
      updated_at: "",
    };
  });

  return (
    <div
      className={cn(
        "grid gap-4",
        items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
      )}
    >
      {items.map((stream) => (
        <CameraStreamCard key={stream.id} stream={stream} vehicleId={vehicleId} />
      ))}
    </div>
  );
}
