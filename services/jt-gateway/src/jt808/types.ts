export type ProtocolVersion = "2011" | "2019";

export interface Jt808Header {
  messageId: number;
  bodyAttributes: number;
  bodyLength: number;
  encrypted: boolean;
  subpackaged: boolean;
  versionFlag: boolean;
  protocolVersion: ProtocolVersion;
  protocolVersionByte?: number;
  terminalNo: string;
  messageSerial: number;
  totalPackages?: number;
  packageNumber?: number;
}

export interface Jt808Frame {
  header: Jt808Header;
  body: Buffer;
  checksum: number;
  rawUnescaped: Buffer;
}

export interface TerminalSessionState {
  sessionId: string;
  terminalId: string | null;
  organizationId: string | null;
  connectionKey: string;
  protocolVersion: ProtocolVersion;
  terminalNo: string;
  authenticated: boolean;
  messageSerial: number;
  remoteIp: string;
  remotePort: number;
  lastRxAt: number;
}

export interface ParsedLocation {
  alarmBits: number;
  statusBits: number;
  latitude: number;
  longitude: number;
  altitudeM: number;
  speedKmh: number;
  directionDeg: number;
  deviceTimeText: string;
  accOn: boolean;
  positioned: boolean;
  northLatitude: boolean;
  eastLongitude: boolean;
  additionalInfo: Record<string, unknown>;
}
