#!/usr/bin/env node
/**
 * Minimal JT808/JT1078 terminal simulator for local development.
 * Usage: npx tsx src/simulator/jt-terminal-simulator.ts --terminal 13800138000 --host 127.0.0.1
 */
import net from "node:net";
import { encodeFrame } from "../jt808/encoder.js";
import { MSG } from "../jt808/constants.js";
import { stringToBcd } from "../jt808/bcd.js";
import { JT1078_MAGIC } from "../jt808/constants.js";

const args = process.argv.slice(2);
function arg(name: string, fallback: string) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
}

const host = arg("host", "127.0.0.1");
const port = Number(arg("port", "6808"));
const terminalNo = arg("terminal", "13800138000");
const protocol = arg("protocol", "2019") as "2011" | "2019";
const mediaPort = Number(arg("media-port", "6809"));

function buildRegistrationBody(): Buffer {
  const parts: Buffer[] = [];
  parts.push(Buffer.from([0, 0])); // province
  parts.push(Buffer.from([0, 0])); // city
  parts.push(Buffer.from("BIRDI".padEnd(5, "\0")));
  parts.push(Buffer.from("BIRDIE-DASH".padEnd(protocol === "2019" ? 30 : 20, "\0")));
  parts.push(Buffer.from("TERM001".padEnd(7, "\0")));
  parts.push(Buffer.from([1]));
  parts.push(Buffer.from("SIM-PLATE", "ascii"));
  return Buffer.concat(parts);
}

function buildLocationBody(lat = 24.7136, lng = 46.6753): Buffer {
  const buf = Buffer.alloc(28);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(0x02, 4); // acc on, positioned
  buf.writeUInt32BE(Math.round(lat * 1_000_000), 8);
  buf.writeUInt32BE(Math.round(lng * 1_000_000), 12);
  buf.writeUInt16BE(600, 16);
  buf.writeUInt16BE(450, 18); // 45.0 km/h
  buf.writeUInt16BE(90, 20);
  const now = new Date();
  const bcd = stringToBcd(
    `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`,
    6,
  );
  bcd.copy(buf, 22);
  return buf;
}

let authCode = "";
let serial = 0;
function nextSerial() {
  serial = (serial + 1) & 0xffff;
  return serial;
}

const socket = net.connect({ host, port }, () => {
  console.log(`Connected to ${host}:${port} as ${terminalNo}`);
  socket.write(
    encodeFrame(MSG.TERMINAL_REGISTRATION, terminalNo, nextSerial(), buildRegistrationBody(), protocol),
  );
});

socket.on("data", (chunk) => {
  console.log("RX", chunk.toString("hex").slice(0, 80));
  if (!authCode && chunk.includes(0x81) && chunk.includes(0x00)) {
    const idx = chunk.indexOf(0x7e, 1);
    if (idx > 10) {
      authCode = chunk.subarray(idx - 12, idx - 1).toString("ascii").replace(/\0/g, "").slice(-12);
      const authBody = Buffer.concat([Buffer.from([authCode.length]), Buffer.from(authCode, "ascii")]);
      if (protocol === "2019") {
        const imei = Buffer.from("860000000000001".padEnd(15, "\0"));
        const sw = Buffer.from("1.0.0");
        const body = Buffer.concat([authBody, imei, Buffer.from([sw.length]), sw]);
        socket.write(
          encodeFrame(MSG.TERMINAL_AUTHENTICATION, terminalNo, nextSerial(), body, protocol),
        );
      } else {
        socket.write(
          encodeFrame(MSG.TERMINAL_AUTHENTICATION, terminalNo, nextSerial(), authBody, protocol),
        );
      }
    }
  }
});

setInterval(() => {
  if (!authCode) return;
  socket.write(encodeFrame(MSG.TERMINAL_HEARTBEAT, terminalNo, nextSerial(), Buffer.alloc(0), protocol));
  socket.write(
    encodeFrame(MSG.LOCATION_REPORT, terminalNo, nextSerial(), buildLocationBody(), protocol),
  );
}, 10_000);

// Sample H.264 NAL when media port connects (Annex-B start code)
function sendSampleH264Media() {
  const nal = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1e]);
  const header = Buffer.alloc(30);
  JT1078_MAGIC.copy(header, 0);
  header.writeUInt8(0x81, 4);
  header.writeUInt8(0x62, 5);
  header.writeUInt16BE(1, 6);
  stringToBcd(terminalNo.slice(-12), 6).copy(header, 8);
  header.writeUInt8(1, 14);
  header.writeUInt8(0x01, 15);
  header.writeBigUInt64BE(BigInt(Date.now()), 16);
  header.writeUInt16BE(0, 24);
  header.writeUInt16BE(0, 26);
  header.writeUInt16BE(nal.length, 28);
  const packet = Buffer.concat([header, nal]);
  const media = net.connect({ host, port: mediaPort }, () => {
    console.log(`Media connected to ${host}:${mediaPort}`);
    media.write(packet);
    setTimeout(() => media.end(), 2000);
  });
}

setTimeout(sendSampleH264Media, 15_000);
