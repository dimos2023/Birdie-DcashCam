import "server-only";

function decodeBasicAuth(authorization: string): { username: string; password: string } | null {
  if (!authorization.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export function getGps51WebhookSecret(): string | undefined {
  return process.env.GPS51_WEBHOOK_SECRET?.trim() || undefined;
}

export function validateGps51WebhookSecret(request: Request, url: URL): boolean {
  const expected = getGps51WebhookSecret();
  if (!expected) {
    console.error("GPS51 webhook rejected: GPS51_WEBHOOK_SECRET is not configured");
    return false;
  }

  const headerSecret = request.headers.get("x-gps51-secret");
  if (headerSecret && headerSecret === expected) return true;

  const querySecret = url.searchParams.get("secret");
  if (querySecret && querySecret === expected) return true;

  const basicUser = process.env.GPS51_WEBHOOK_BASIC_USER?.trim();
  const basicPassword = process.env.GPS51_WEBHOOK_BASIC_PASSWORD?.trim();
  const authorization = request.headers.get("authorization");

  if (authorization) {
    const credentials = decodeBasicAuth(authorization);
    if (credentials) {
      if (basicUser && basicPassword) {
        if (credentials.username === basicUser && credentials.password === basicPassword) {
          return true;
        }
      }
      if (credentials.password === expected || credentials.username === expected) {
        return true;
      }
    }
  }

  return false;
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
