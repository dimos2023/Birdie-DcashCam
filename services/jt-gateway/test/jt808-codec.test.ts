import { describe, expect, it } from "vitest";
import { escapeFrame, unescapeFrame } from "../src/jt808/escape.js";
import { computeChecksum, verifyChecksum } from "../src/jt808/checksum.js";
import { encodeFrame, decodeFrame } from "../src/jt808/encoder.js";
import { FrameBuffer } from "../src/jt808/frame-buffer.js";
import { parseLocationBody } from "../src/jt808/messages/location.js";
import { MSG } from "../src/jt808/constants.js";
import { decodeJt1078Packet } from "../src/jt1078/packet-decoder.js";
import { FrameAssembler } from "../src/jt1078/frame-assembler.js";
import { stringToBcd } from "../src/jt808/bcd.js";
import { JT1078_MAGIC } from "../src/jt808/constants.js";

describe("JT808 escape", () => {
  it("round-trips escape and unescape", () => {
    const raw = Buffer.from([0x01, 0x7e, 0x7d, 0x02]);
    const escaped = escapeFrame(raw);
    expect(unescapeFrame(escaped).equals(raw)).toBe(true);
  });
});

describe("JT808 checksum", () => {
  it("validates xor checksum", () => {
    const data = Buffer.from([0x01, 0x02, 0x03]);
    const cs = computeChecksum(data);
    expect(verifyChecksum(data, cs)).toBe(true);
    expect(verifyChecksum(data, cs ^ 0xff)).toBe(false);
  });
});

describe("JT808 frame codec", () => {
  it("encodes and decodes 2019 header", () => {
    const body = Buffer.from([0xaa]);
    const frame = encodeFrame(MSG.TERMINAL_HEARTBEAT, "13800138000", 1, body, "2019");
    const between = frame.subarray(1, frame.length - 1);
    const decoded = decodeFrame(between);
    expect(decoded.frame?.header.messageId).toBe(MSG.TERMINAL_HEARTBEAT);
    expect(decoded.frame?.header.protocolVersion).toBe("2019");
    expect(decoded.frame?.header.terminalNo).toContain("13800138000");
  });

  it("extracts multiple frames from one TCP chunk", () => {
    const f1 = encodeFrame(MSG.TERMINAL_HEARTBEAT, "13800138000", 1, Buffer.alloc(0), "2011");
    const f2 = encodeFrame(MSG.TERMINAL_HEARTBEAT, "13800138000", 2, Buffer.alloc(0), "2011");
    const buf = new FrameBuffer(65535);
    const frames = buf.push(Buffer.concat([f1, f2]));
    expect(frames.length).toBe(2);
  });
});

describe("JT808 location", () => {
  it("parses coordinates and speed", () => {
    const body = Buffer.alloc(28);
    body.writeUInt32BE(0, 0);
    body.writeUInt32BE(0x06, 4);
    body.writeUInt32BE(24_713_600, 8);
    body.writeUInt32BE(46_675_300, 12);
    body.writeUInt16BE(100, 16);
    body.writeUInt16BE(355, 18);
    body.writeUInt16BE(180, 20);
    stringToBcd("250629120000", 6).copy(body, 22);
    const loc = parseLocationBody(body);
    expect(loc.latitude).toBeCloseTo(24.7136, 4);
    expect(loc.longitude).toBeCloseTo(46.6753, 4);
    expect(loc.speedKmh).toBeCloseTo(35.5, 1);
  });
});

describe("JT1078", () => {
  it("decodes dynamic header with video body", () => {
    const nal = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x65]);
    const buf = Buffer.alloc(30 + nal.length);
    JT1078_MAGIC.copy(buf, 0);
    buf.writeUInt8(0x81, 4);
    buf.writeUInt8(0x62, 5);
    buf.writeUInt16BE(1, 6);
    stringToBcd("13800138000", 6).copy(buf, 8);
    buf.writeUInt8(1, 14);
    buf.writeUInt8(0x01, 15);
    buf.writeBigUInt64BE(BigInt(1), 16);
    buf.writeUInt16BE(0, 24);
    buf.writeUInt16BE(0, 26);
    buf.writeUInt16BE(nal.length, 28);
    nal.copy(buf, 30);
    const pkt = decodeJt1078Packet(buf, 65535);
    expect(pkt?.bodyLength).toBe(nal.length);
    expect(pkt?.dataType).toBe(0);
  });

  it("assembles fragmented frames", () => {
    const asm = new FrameAssembler(1_000_000, 5000);
    const mk = (frag: number, body: Buffer) => ({
      magic: JT1078_MAGIC,
      vpxcc: 0,
      m: false,
      pt: 98,
      serial: 1,
      simNo: "13800138000",
      logicalChannel: 1,
      dataType: 0 as const,
      fragment: frag as 0 | 1 | 2 | 3,
      bodyLength: body.length,
      body,
      headerLength: 30 + body.length,
      raw: Buffer.concat([body]),
    });
    asm.push(mk(1, Buffer.from([1, 2])));
    const done = asm.push(mk(2, Buffer.from([3, 4])));
    expect(done?.data.equals(Buffer.from([1, 2, 3, 4]))).toBe(true);
  });
});
