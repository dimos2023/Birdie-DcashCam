import { parseBcdDeviceTime } from "../bcd.js";
import type { ParsedLocation } from "../types.js";

export function parseLocationBody(body: Buffer): ParsedLocation {
  let pos = 0;
  const alarmBits = body.readUInt32BE(pos);
  pos += 4;
  const statusBits = body.readUInt32BE(pos);
  pos += 4;
  const latRaw = body.readUInt32BE(pos);
  pos += 4;
  const lngRaw = body.readUInt32BE(pos);
  pos += 4;
  const altitudeM = body.readUInt16BE(pos);
  pos += 2;
  const speedRaw = body.readUInt16BE(pos);
  pos += 2;
  const directionDeg = body.readUInt16BE(pos);
  pos += 2;
  const timeBuf = body.subarray(pos, pos + 6);
  pos += 6;

  const northLatitude = (statusBits & 0x02) !== 0;
  const eastLongitude = (statusBits & 0x04) !== 0;
  const accOn = (statusBits & 0x01) !== 0;
  const positioned = (statusBits & 0x02) !== 0;

  let latitude = latRaw / 1_000_000;
  let longitude = lngRaw / 1_000_000;
  if (!northLatitude) latitude = -latitude;
  if (!eastLongitude) longitude = -longitude;

  const additionalInfo = parseAdditionalInfo(body.subarray(pos));

  return {
    alarmBits,
    statusBits,
    latitude,
    longitude,
    altitudeM,
    speedKmh: speedRaw / 10,
    directionDeg,
    deviceTimeText: parseBcdDeviceTime(timeBuf),
    accOn,
    positioned,
    northLatitude,
    eastLongitude,
    additionalInfo,
  };
}

function parseAdditionalInfo(buf: Buffer): Record<string, unknown> {
  const info: Record<string, unknown> = {};
  let pos = 0;
  while (pos + 2 <= buf.length) {
    const id = buf.readUInt8(pos);
    pos += 1;
    const len = buf.readUInt8(pos);
    pos += 1;
    if (pos + len > buf.length) break;
    const value = buf.subarray(pos, pos + len);
    pos += len;
    switch (id) {
      case 0x01:
        info.mileage_km = value.readUInt32BE(0) / 10;
        break;
      case 0x02:
        info.fuel_l = value.readUInt16BE(0) / 10;
        break;
      case 0x03:
        info.recorder_speed_kmh = value.readUInt16BE(0) / 10;
        break;
      case 0x30:
        info.signal_strength = value.readUInt8(0);
        break;
      case 0x31:
        info.satellite_count = value.readUInt8(0);
        break;
      default:
        info[`0x${id.toString(16).padStart(2, "0")}`] = value.toString("hex");
    }
  }
  return info;
}
