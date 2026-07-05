import { decodeFrame } from "./encoder.js";
import type { Jt808Frame } from "./types.js";
import { FRAME_DELIMITER } from "./constants.js";

export class FrameBuffer {
  private buffer = Buffer.alloc(0);

  constructor(private readonly maxFrameBytes: number) {}

  push(chunk: Buffer): Jt808Frame[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const frames: Jt808Frame[] = [];

    while (true) {
      const start = this.buffer.indexOf(FRAME_DELIMITER);
      if (start < 0) {
        if (this.buffer.length > this.maxFrameBytes) {
          this.buffer = this.buffer.subarray(-this.maxFrameBytes);
        }
        break;
      }
      if (start > 0) this.buffer = this.buffer.subarray(start);
      const end = this.buffer.indexOf(FRAME_DELIMITER, 1);
      if (end < 0) break;

      const between = this.buffer.subarray(1, end);
      this.buffer = this.buffer.subarray(end);

      if (between.length > this.maxFrameBytes) continue;

      const result = decodeFrame(between);
      if (result.frame) frames.push(result.frame);
    }

    return frames;
  }

  reset() {
    this.buffer = Buffer.alloc(0);
  }
}

export { decodeFrame };
