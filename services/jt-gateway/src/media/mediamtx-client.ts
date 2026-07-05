import type { AppConfig } from "../config.js";

export function buildPlaybackUrl(config: AppConfig, sessionKey: string): string {
  const base = config.MEDIAMTX_HLS_BASE_URL.replace(/\/$/, "");
  return `${base}/${sessionKey}/index.m3u8`;
}

export function buildRtspPublishUrl(config: AppConfig, sessionKey: string): string {
  const base = config.MEDIAMTX_RTSP_URL.replace(/\/$/, "");
  return `${base}/${sessionKey}`;
}
