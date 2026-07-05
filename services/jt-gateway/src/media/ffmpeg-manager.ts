import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { AppConfig } from "../config.js";
import type { Logger } from "../logger.js";

export interface FfmpegPipeline {
  sessionKey: string;
  process: ChildProcessWithoutNullStreams;
  stop: () => void;
}

const pipelines = new Map<string, FfmpegPipeline>();

export function startH264Pipeline(
  config: AppConfig,
  log: Logger,
  sessionKey: string,
  rtspPublishUrl: string,
  transcodeFromH265 = false,
): FfmpegPipeline | null {
  if (pipelines.has(sessionKey)) return pipelines.get(sessionKey) ?? null;

  const args = transcodeFromH265
    ? ["-f", "hevc", "-i", "pipe:0", "-c:v", "libx264", "-preset", "veryfast", "-f", "rtsp", rtspPublishUrl]
    : ["-f", "h264", "-i", "pipe:0", "-c:v", "copy", "-f", "rtsp", rtspPublishUrl];

  const proc = spawn(config.FFMPEG_PATH, args, { stdio: ["pipe", "ignore", "pipe"] });
  proc.stderr.on("data", (chunk: Buffer) => {
    log.debug({ session_key: sessionKey, ffmpeg: chunk.toString().slice(0, 200) });
  });
  proc.on("exit", (code) => {
    log.info({ session_key: sessionKey, code }, "FFmpeg exited");
    pipelines.delete(sessionKey);
  });

  const pipeline: FfmpegPipeline = {
    sessionKey,
    process: proc,
    stop: () => {
      try {
        proc.stdin.end();
        proc.kill("SIGTERM");
      } catch {
        /* ignore */
      }
      pipelines.delete(sessionKey);
    },
  };
  pipelines.set(sessionKey, pipeline);
  return pipeline;
}

export function writeFrame(sessionKey: string, data: Buffer) {
  const p = pipelines.get(sessionKey);
  if (!p?.process.stdin.writable) return;
  p.process.stdin.write(data);
}

export function stopPipeline(sessionKey: string) {
  pipelines.get(sessionKey)?.stop();
}

export function stopAllPipelines() {
  for (const p of pipelines.values()) p.stop();
  pipelines.clear();
}

export function getPipelineCount() {
  return pipelines.size;
}
