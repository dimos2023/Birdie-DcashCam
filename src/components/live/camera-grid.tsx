"use client";

import { useState } from "react";
import {
  Camera,
  Maximize2,
  Radio,
  Video,
  Volume2,
  VolumeX,
  ImageIcon,
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DeviceType = "dash_cam" | "gps_tracker" | "combo" | null;

interface PlaceholderStream {
  id: string;
  channel_name: string;
  is_live: boolean;
  stream_type: string;
}

const CHANNELS_BY_TYPE: Record<string, string[]> = {
  dash_cam: ["Front", "Rear"],
  combo: ["Front", "Rear", "Cabin"],
  default: ["Front", "Rear"],
};

function getChannelNames(deviceType: DeviceType): string[] {
  if (deviceType === "gps_tracker") return [];
  return CHANNELS_BY_TYPE[deviceType ?? "default"] ?? CHANNELS_BY_TYPE.default;
}

function buildPlaceholderStreams(
  vehicleId: string,
  deviceType: DeviceType
): PlaceholderStream[] {
  return getChannelNames(deviceType).map((channel, i) => ({
    id: `placeholder-${channel}`,
    channel_name: channel,
    is_live: i < 2,
    stream_type: "hls",
  }));
}

interface CameraStreamCardProps {
  stream: PlaceholderStream;
  vehicleId: string;
}

function CameraStreamCard({ stream, vehicleId }: CameraStreamCardProps) {
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const streamUrl = `https://stream.birdie.sa/hls/${vehicleId}/${stream.channel_name.toLowerCase()}/index.m3u8`;

  const handleSnapshot = () => {
    toast.success(`Snapshot captured — ${stream.channel_name}`, {
      description: "Snapshot storage will be available in production.",
    });
  };

  const handleFullscreen = () => {
    setFullscreen(true);
    toast.info("Fullscreen placeholder", {
      description: "Video player integration coming soon.",
    });
  };

  const handleMute = () => {
    setMuted((m) => !m);
    toast.info(muted ? "Audio unmuted (demo)" : "Audio muted (demo)");
  };

  return (
    <>
      <Card className="overflow-hidden border border-[#e8f2fa] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 bg-[#1C3664] px-4 py-3 text-white">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">{stream.channel_name}</CardTitle>
          </div>
          <Badge
            className={cn(
              "text-xs",
              stream.is_live
                ? "bg-red-500 text-white hover:bg-red-500"
                : "bg-white/20 text-white hover:bg-white/20"
            )}
          >
            {stream.is_live ? (
              <>
                <Radio className="mr-1 h-3 w-3 animate-pulse" />
                Live
              </>
            ) : (
              "Offline"
            )}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative flex aspect-video items-center justify-center bg-[#1C1C1C]">
            {stream.is_live ? (
              <div className="flex flex-col items-center gap-2 px-4 text-center text-white/60">
                <Video className="h-10 w-10 md:h-12 md:w-12" />
                <p className="text-sm font-medium text-white/80">Stream preview</p>
                <p className="max-w-[220px] truncate font-mono text-[10px] text-white/35">
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
                onClick={handleMute}
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
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="secondary"
                className="bg-black/50 text-white hover:bg-black/70"
                onClick={handleFullscreen}
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
  deviceType?: DeviceType;
}

export function CameraGrid({ vehicleId, deviceType }: CameraGridProps) {
  const channelNames = getChannelNames(deviceType ?? null);

  if (channelNames.length === 0) {
    return (
      <div className="rounded-xl border border-[#e8f2fa] bg-white p-10 text-center shadow-sm">
        <Camera className="mx-auto h-10 w-10 text-[#3B8ECC]" />
        <p className="mt-3 font-semibold text-[#1C3664]">No cameras on this device</p>
        <p className="mt-1 text-sm text-[#1C1C1C]/55">
          GPS-only trackers do not include video channels.
        </p>
      </div>
    );
  }

  const streams = buildPlaceholderStreams(vehicleId, deviceType ?? null);

  return (
    <div
      className={cn(
        "grid gap-4",
        streams.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
      )}
    >
      {streams.map((stream) => (
        <CameraStreamCard key={stream.id} stream={stream} vehicleId={vehicleId} />
      ))}
    </div>
  );
}
