import "server-only";

function envValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

/** Seconds before access_token expiry when we already refresh (Zoho default ~1h). */
const TOKEN_REFRESH_EARLY_SECONDS = 120;

type ZohoTokenJson = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

let accessTokenCache: { token: string; expiresAtMs: number } | null = null;
let refreshInFlight: Promise<string> | null = null;

/**
 * Fetches a Zoho OAuth access token, reusing a cached token until near expiry.
 * Coalesces concurrent refreshes so preview + reconcile + polling do not hammer
 * the Zoho Accounts oauth/v2/token endpoint (Zoho rate-limits that URL).
 */
export async function fetchZohoSignAccessToken(): Promise<string> {
  const now = Date.now();
  if (accessTokenCache && accessTokenCache.expiresAtMs > now) {
    return accessTokenCache.token;
  }
  if (refreshInFlight) {
    return refreshInFlight;
  }
  refreshInFlight = refreshZohoAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function refreshZohoAccessToken(): Promise<string> {
  const clientId = envValue("ZOHO_SIGN_CLIENT_ID", "ZOHO_CLIENT_ID");
  const clientSecret = envValue("ZOHO_SIGN_CLIENT_SECRET", "ZOHO_CLIENT_SECRET");
  const refreshToken = envValue("ZOHO_SIGN_REFRESH_TOKEN", "ZOHO_REFRESH_TOKEN");
  const accountsHost = envValue("ZOHO_ACCOUNTS_HOST", "ZOHO_ACCOUNTS_BASE_URL") || "https://accounts.zoho.com";

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Zoho OAuth environment configuration");
  }

  const accountsBase = accountsHost.replace(/\/$/, "");
  const tokenUrl = `${accountsBase}${"/oauth/v2/token"}`;
  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const tokenText = await tokenRes.text();
  let tokenJson: ZohoTokenJson = {};
  try {
    tokenJson = JSON.parse(tokenText) as ZohoTokenJson;
  } catch {
    const preview = tokenText.replace(/\s+/g, " ").slice(0, 240);
    const tail = preview ? " Body preview: " + preview : " Empty body.";
    throw new Error("Zoho token response was not valid JSON (HTTP " + tokenRes.status + ")." + tail);
  }

  if (!tokenRes.ok || !tokenJson.access_token) {
    const zohoErr = [tokenJson.error, tokenJson.error_description].filter(Boolean).join(": ");
    const suffix = zohoErr
      ? " Zoho says: " + zohoErr + "."
      : tokenText
        ? " Raw: " + tokenText.slice(0, 300)
        : "";
    const dcHint =
      /invalid.*code|invalid.*token|invalid_grant/i.test(zohoErr + tokenText)
        ? " Regenerate the refresh token for this app, and if your account is EU/IN/AU/etc., set ZOHO_ACCOUNTS_HOST to the matching Zoho Accounts URL (e.g. https://accounts.zoho.eu)."
        : "";
    const rateHint = /too many requests|continuously/i.test(zohoErr + tokenText)
      ? " Wait a few minutes before retrying. This app now caches access tokens so normal use should not hit this limit."
      : "";
    throw new Error(
      "Failed to obtain Zoho access token (HTTP " +
        String(tokenRes.status) +
        ", " +
        tokenUrl +
        ")." +
        suffix +
        dcHint +
        rateHint,
    );
  }

  const expiresIn =
    typeof tokenJson.expires_in === "number" && tokenJson.expires_in > 0 ? tokenJson.expires_in : 3600;
  const ttlSeconds = Math.max(60, expiresIn - TOKEN_REFRESH_EARLY_SECONDS);
  accessTokenCache = {
    token: tokenJson.access_token,
    expiresAtMs: Date.now() + ttlSeconds * 1000,
  };

  return tokenJson.access_token;
}

export function zohoSignApiBaseCandidates(): string[] {
  const configuredBase = envValue("ZOHO_SIGN_API_BASE", "ZOHO_SIGN_BASE_URL");
  return [...new Set([configuredBase, "https://sign.zoho.com", "https://www.zoho.com"].filter(Boolean))];
}

export type ZohoSignDbStatus = "sent" | "viewed" | "signed" | "completed" | "declined";

/** Map Zoho Sign requests.request_status from REST API or webhooks to our DB enum. */
export function mapZohoRequestStatusToDb(raw: string | null | undefined): ZohoSignDbStatus | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (s.includes("complete")) return "completed";
  if (s.includes("declin") || s.includes("reject")) return "declined";
  if (s.includes("expir")) return "declined";
  if (s.includes("view")) return "viewed";
  if ((/\bsigned\b/.test(s) || s.includes("partially_signed")) && !s.includes("unsigned")) return "signed";
  if (s.includes("progress") || s.includes("pending") || s.includes("sent") || s.includes("draft")) return "sent";
  return null;
}

export async function fetchZohoRequestJson(requestId: string): Promise<{
  request_status: string | null;
  raw: unknown;
}> {
  const accessToken = await fetchZohoSignAccessToken();
  let lastBody = "";
  let lastStatus = 0;

  for (const base of zohoSignApiBaseCandidates()) {
    const signBase = base.replace(/\/$/, "");
    const reqPath = "/api/v1/requests/" + encodeURIComponent(requestId);
    const res = await fetch(signBase + reqPath, {
      headers: { Authorization: "Zoho-oauthtoken " + accessToken },
    });
    lastStatus = res.status;
    const text = await res.text();
    lastBody = text;
    if (!res.ok) continue;

    let json: unknown;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      continue;
    }

    const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
    const requests = root.requests;
    let reqObj: Record<string, unknown>;
    if (Array.isArray(requests) && requests[0] && typeof requests[0] === "object") {
      reqObj = requests[0] as Record<string, unknown>;
    } else if (requests && typeof requests === "object") {
      reqObj = requests as Record<string, unknown>;
    } else {
      reqObj = root;
    }
    const rs = reqObj.request_status;
    const request_status = typeof rs === "string" ? rs : null;
    return { request_status, raw: json };
  }

  throw new Error("Failed to fetch Zoho request (" + lastStatus + "): " + lastBody.slice(0, 500));
}
