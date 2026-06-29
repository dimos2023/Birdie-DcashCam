import "server-only";

export type Gps51SecretSource =
  | "query"
  | "header"
  | "authorization_bearer"
  | "body"
  | null;

export type Gps51AuthDebug = {
  expectedSecretConfigured: boolean;
  expectedSecretLength: number;
  providedSecretLength: number;
  source: Gps51SecretSource;
};

function trimSecret(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getGps51WebhookSecret(): string | undefined {
  return trimSecret(process.env.GPS51_WEBHOOK_SECRET);
}

function secretFromBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;
  if (record.secret == null) return undefined;
  return trimSecret(String(record.secret));
}

export function extractProvidedSecret(
  request: Request,
  url: URL,
  body?: unknown
): { secret?: string; source: Gps51SecretSource } {
  const querySecret = trimSecret(url.searchParams.get("secret"));
  if (querySecret) {
    return { secret: querySecret, source: "query" };
  }

  const headerSecret = trimSecret(request.headers.get("x-gps51-secret"));
  if (headerSecret) {
    return { secret: headerSecret, source: "header" };
  }

  const authorization = request.headers.get("authorization");
  if (authorization) {
    const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch?.[1]) {
      const bearerSecret = trimSecret(bearerMatch[1]);
      if (bearerSecret) {
        return { secret: bearerSecret, source: "authorization_bearer" };
      }
    }
  }

  const bodySecret = secretFromBody(body);
  if (bodySecret) {
    return { secret: bodySecret, source: "body" };
  }

  return { secret: undefined, source: null };
}

export function validateGps51WebhookAuth(
  request: Request,
  url: URL,
  body?: unknown
): { authorized: boolean; debug: Gps51AuthDebug } {
  const expected = getGps51WebhookSecret();
  const { secret, source } = extractProvidedSecret(request, url, body);

  const debug: Gps51AuthDebug = {
    expectedSecretConfigured: Boolean(expected),
    expectedSecretLength: expected?.length ?? 0,
    providedSecretLength: secret?.length ?? 0,
    source,
  };

  if (!expected || !secret) {
    return { authorized: false, debug };
  }

  return {
    authorized: secret === expected,
    debug,
  };
}

export function logGps51AuthDebug(debug: Gps51AuthDebug, authorized: boolean): void {
  const message = authorized ? "GPS51 webhook authorized" : "GPS51 webhook unauthorized";
  console.log(message, debug);
}

export function headersToJson(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() === "authorization") {
      headers[key] = "[redacted]";
      return;
    }
    headers[key] = value;
  });
  return headers;
}

export function stripSecretFromPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const record = { ...(payload as Record<string, unknown>) };
  if ("secret" in record) {
    delete record.secret;
  }
  return record;
}
