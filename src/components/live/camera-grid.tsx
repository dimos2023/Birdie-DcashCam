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
  WifiOff,
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

export interface CameraStreamData {
  id: string;
  channel_name: string;
  is_live: boolean;
  stream_type?: string;
  stream_url?: string | null;
}

interface CameraSlot {
  id: string;
  channel_name: string;
  is_live: boolean;
  stream_type: string;
  stream_url: string | null;
  status: "live" | "offline" | "waiting";
}

const CAMERA_CHANNELS = ["Front", "Rear", "Cabin"] as const;

function resolveSlotStatus(
  channel: string,
  deviceType: DeviceType,
  hasVideoDevice: boolean,
  stream?: CameraStreamData
): CameraSlot["status"] {
  if (stream?.is_live) return "live";
  if (!hasVideoDevice || deviceType === "gps_tracker") return "waiting";
  if (deviceType === "dash_cam" && channel === "Cabin") return "waiting";
  if (hasVideoDevice) return "offline";
  return "waiting";
}

function buildCameraSlots(
  vehicleId: string,
  deviceType: DeviceType,
  hasVideoDevice: boolean,
  streams?: CameraStreamData[]
): CameraSlot[] {
  return CAMERA_CHANNELS.map((channel) => {
    const matched = streams?.find(
      (stream) => stream.channel_name.toLowerCase() === channel.toLowerCase()
    );
    const status = resolveSlotStatus(channel, deviceType, hasVideoDevice, matched);
    const defaultUrl = `https://stream.birdie.sa/hls/${vehicleId}/${channel.toLowerCase()}/index.m3u8`;

    return {
      id: matched?.id ?? `slot-${channel.toLowerCase()}`,
      channel_name: channel,
      is_live: status === "live",
      stream_type: matched?.stream_type ?? "hls",
      stream_url: matched?.stream_url ?? defaultUrl,
      status,
    };
  });
}

interface CameraStreamCardProps {
  slot: CameraSlot;
}

function CameraStreamCard({ slot }: CameraStreamCardProps) {
  const [muted, setMuted] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const handleSnapshot = () => {
    toast.success(`Snapshot captured — ${slot.channel_name}`, {
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
    setMuted((value) => !value);
    toast.info(muted ? "Audio unmuted (demo)" : "Audio muted (demo)");
  };

  return (
    <>
      <Card className="overflow-hidden border border-[#e8f2fa] shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 bg-[#1C3664] px-3 py-2.5 text-white">
          <div className="flex items-center gap-2">
            <Camera className="h-3.5 w-3.5" />
            <CardTitle className="text-xs font-medium md:text-sm">
              {slot.channel_name}
            </CardTitle>
          </div>
          <Badge
            className={cn(
              "text-[10px] md:text-xs",
              slot.status === "live"
                ? "bg-red-500 text-white hover:bg-red-500"
                : slot.status === "waiting"
                  ? "bg-white/15 text-white/80 hover:bg-white/15"
                  : "bg-amber-500/90 text-white hover:bg-amber-500/90"
            )}
          >
            {slot.status === "live" ? (
              <>
                <Radio className="mr-1 h-3 w-3 animate-pulse" />
                Live
              </>
            ) : slot.status === "waiting" ? (
              "Awaiting"
            ) : (
              "Offline"
            )}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative flex aspect-video items-center justify-center bg-[#1C1C1C]">
            {slot.status === "live" ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center text-white/60">
                <Video className="h-8 w-8 md:h-10 md:w-10" />
                <p className="text-xs font-medium text-white/85 md:text-sm">Live stream</p>
                <p className="max-w-full truncate font-mono text-[9px] text-white/35 md:text-[10px]">
                  {slot.stream_url}
                </p>
              </div>
            ) : slot.status === "waiting" ? (
              <div className="flex flex-col items-center gap-2 px-4 text-center text-white/45">
                <WifiOff className="h-8 w-8 md:h-9 md:w-9" />
                <p className="text-xs font-medium text-white/70 md:text-sm">Awaiting connection</p>
                <p className="text-[10px] text-white/40 md:text-xs">
                  Camera feed will appear here when linked
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/40">
                <Camera className="h-8 w-8 md:h-9 md:w-9" />
                <p className="text-xs md:text-sm">Camera offline</p>
              </div>
            )}

            {slot.status === "live" && (
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
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-4xl border-0 p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="text-[#1C3664]">
              {slot.channel_name} — Fullscreen
            </DialogTitle>
          </DialogHeader>
          <div className="flex aspect-video items-center justify-center bg-[#1C1C1C]">
            <div className="text-center text-white/60">
              <Video className="mx-auto h-16 w-16" />
              <p className="mt-3 text-sm">HLS / WebRTC player placeholder</p>
              <p className="mt-1 font-mono text-xs text-white/40">{slot.stream_url}</p>
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
  hasVideoDevice?: boolean;
  streams?: CameraStreamData[];
}

export function CameraGrid({
  vehicleId,
  deviceType = null,
  hasVideoDevice = false,
  streams,
}: CameraGridProps) {
  const slots = buildCameraSlots(vehicleId, deviceType, hasVideoDevice, streams);
  const liveCount = slots.filter((slot) => slot.status === "live").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[#1C1C1C]/50">
          {liveCount > 0
            ? `${liveCount} of 3 cameras streaming live`
            : "3 camera channels — connect device to start live feeds"}
        </p>
        {deviceType === "gps_tracker" && (
          <Badge variant="outline" className="text-[10px] text-[#1C1C1C]/60">
            GPS device — no video
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => (
          <CameraStreamCard key={slot.id} slot={slot} />
        ))}
      </div>
    </div>
  );
}
