import type { Jt1078Packet } from "./types.js";

export interface AssembledFrame {
  key: string;
  data: Buffer;
  dataType: number;
}

export class FrameAssembler {
  private fragments = new Map<string, Buffer[]>();
  private lastSerial = new Map<string, number>();

  constructor(
    private readonly maxFrameBytes: number,
    private readonly timeoutMs: number,
  ) {}

  push(packet: Jt1078Packet): AssembledFrame | null {
    const key = `${packet.simNo}:${packet.logicalChannel}`;
    const prev = this.lastSerial.get(key);
    if (prev !== undefined && packet.serial !== ((prev + 1) & 0xffff)) {
      // gap detected — caller may increment packet loss counter
    }
    this.lastSerial.set(key, packet.serial);

    if (packet.fragment === 0) {
      if (packet.body.length > this.maxFrameBytes) return null;
      return { key, data: packet.body, dataType: packet.dataType };
    }

    const list = this.fragments.get(key) ?? [];
    if (packet.fragment === 1) {
      this.fragments.set(key, [packet.body]);
      return null;
    }
    list.push(packet.body);
    if (packet.fragment === 2) {
      this.fragments.set(key, list);
      const data = Buffer.concat(list);
      this.fragments.delete(key);
      if (data.length > this.maxFrameBytes) return null;
      return { key, data, dataType: packet.dataType };
    }
    this.fragments.set(key, list);
    return null;
  }

  prune(now = Date.now()) {
    void now;
    // MVP: fragments cleared on complete or disconnect; timeout hook for future use
    if (this.fragments.size > 1000) this.fragments.clear();
  }
}
