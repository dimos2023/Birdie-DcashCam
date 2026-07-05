import type { Socket } from "node:net";
import type { TerminalSessionState } from "./types.js";
import { SerialCounter } from "./serial-counter.js";

export interface LiveSession extends TerminalSessionState {
  socket: Socket;
  serial: SerialCounter;
  pendingAcks: Map<number, { commandId?: string; responseMessageId: number }>;
}

const sessionsByConnection = new Map<string, LiveSession>();
const sessionsByTerminalId = new Map<string, LiveSession>();

export function createConnectionKey(remoteAddress: string, remotePort: number): string {
  return `${remoteAddress}:${remotePort}:${Date.now()}`;
}

export function registerSession(session: LiveSession) {
  sessionsByConnection.set(session.connectionKey, session);
  if (session.terminalId) {
    const existing = sessionsByTerminalId.get(session.terminalId);
    if (existing && existing.connectionKey !== session.connectionKey) {
      try {
        existing.socket.destroy();
      } catch {
        /* ignore */
      }
      sessionsByConnection.delete(existing.connectionKey);
    }
    sessionsByTerminalId.set(session.terminalId, session);
  }
}

export function getSessionByConnection(connectionKey: string): LiveSession | undefined {
  return sessionsByConnection.get(connectionKey);
}

export function getSessionByTerminalId(terminalId: string): LiveSession | undefined {
  return sessionsByTerminalId.get(terminalId);
}

export function removeSession(connectionKey: string) {
  const session = sessionsByConnection.get(connectionKey);
  if (!session) return;
  sessionsByConnection.delete(connectionKey);
  if (session.terminalId) {
    const current = sessionsByTerminalId.get(session.terminalId);
    if (current?.connectionKey === connectionKey) {
      sessionsByTerminalId.delete(session.terminalId);
    }
  }
}

export function listSessions(): LiveSession[] {
  return [...sessionsByConnection.values()];
}
