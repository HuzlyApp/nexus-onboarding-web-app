import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonObject = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const statusEventMatchers: Array<{ status: string; patterns: RegExp[] }> = [
  { status: "sent", patterns: [/request_sent/, /\bsent\b/] },
  { status: "viewed", patterns: [/request_viewed/, /action_viewed/, /\bviewed\b/] },
  { status: "signed", patterns: [/request_signed/, /signed_by_recipient/, /\bsigned\b/] },
  { status: "completed", patterns: [/request_completed/, /completed_by_all/, /\bcompleted\b/] },
  { status: "declined", patterns: [/request_declined/, /\bdeclined\b/, /\brejected\b/] },
];

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function normalizeEventText(value: string): string {
  return value.trim().toLowerCase().replace(/[.\s-]+/g, "_");
}

function toJsonObject(input: unknown): JsonObject {
  return input && typeof input === "object" ? (input as JsonObject) : {};
}

function getNotificationBlock(body: JsonObject): JsonObject | null {
  const notifications = body.notifications;
  if (Array.isArray(notifications) && notifications.length > 0) {
    return toJsonObject(notifications[0]);
  }
  if (notifications && typeof notifications === "object") {
    return toJsonObject(notifications);
  }
  return null;
}

function getEventType(body: JsonObject): string | null {
  const n = getNotificationBlock(body);
  const requestObj = toJsonObject(body.requests);
  const candidates = [
    n?.operation_type,
    n?.event_type,
    body.event_type,
    body.operation_type,
    requestObj.request_status,
    body.status,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function mapZohoEventToStatus(eventType: string | null): string | null {
  if (!eventType) return null;
  const normalized = normalizeEventText(eventType);
  for (const matcher of statusEventMatchers) {
    if (matcher.patterns.some((pattern) => pattern.test(normalized))) {
      return matcher.status;
    }
  }
  return null;
}

function getRequestId(body: JsonObject): string | null {
  const requestObj = toJsonObject(body.requests);
  const direct = [requestObj.request_id, body.request_id, body.requestId];
  for (const value of direct) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getRecipientEmail(body: JsonObject): string | null {
  const requestObj = toJsonObject(body.requests);
  const actions = Array.isArray(requestObj.actions) ? requestObj.actions : [];
  for (const action of actions) {
    const email = toJsonObject(action).recipient_email;
    if (typeof email === "string" && email.trim()) return email.trim().toLowerCase();
  }

  const direct = [body.email, body.recipient_email];
  for (const value of direct) {
    if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
  }
  return null;
}

async function parsePayload(rawBody: string, contentType: string): Promise<JsonObject> {
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(rawBody);
    const dataParam = params.get("data");
    if (dataParam) {
      try {
        return JSON.parse(dataParam) as JsonObject;
      } catch {
        return { data: dataParam };
      }
    }
    return Object.fromEntries(params.entries());
  }

  try {
    return JSON.parse(rawBody || "{}") as JsonObject;
  } catch {
    return {};
  }
}

function getSignatureCandidate(req: Request): string {
  return (
    req.headers.get("x-zoho-signature") ||
    req.headers.get("x-zoho-hmac-signature") ||
    req.headers.get("x-webhook-signature") ||
    ""
  ).trim();
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const keyData = new TextEncoder().encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyWebhook(req: Request, rawBody: string): Promise<{ ok: boolean; reason: string }> {
  const sharedSecret = Deno.env.get("ZOHO_WEBHOOK_SECRET")?.trim();
  const hmacSecret = Deno.env.get("ZOHO_WEBHOOK_HMAC_SECRET")?.trim();
  const providedSharedSecret =
    req.headers.get("x-zoho-webhook-secret") ||
    req.headers.get("x-webhook-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const providedSignature = getSignatureCandidate(req);

  if (hmacSecret) {
    if (!providedSignature) return { ok: false, reason: "missing signature header" };
    const expected = await hmacSha256Hex(hmacSecret, rawBody);
    const sanitizedProvided = providedSignature.toLowerCase().replace(/^sha256=/, "");
    return {
      ok: expected === sanitizedProvided,
      reason: expected === sanitizedProvided ? "verified by HMAC" : "invalid HMAC signature",
    };
  }

  if (sharedSecret) {
    const ok = providedSharedSecret.trim() === sharedSecret;
    return { ok, reason: ok ? "verified by shared secret" : "invalid shared secret header" };
  }

  return { ok: true, reason: "no webhook secret configured" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  const rawBody = await req.text();
  const contentType = req.headers.get("content-type") || "";
  const payload = await parsePayload(rawBody, contentType);
  const requestId = getRequestId(payload);
  const eventType = getEventType(payload);
  const mappedStatus = mapZohoEventToStatus(eventType);
  const recipientEmail = getRecipientEmail(payload);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const hasDbAccess = Boolean(supabaseUrl && serviceKey);
  const supabase = hasDbAccess ? createClient(supabaseUrl!, serviceKey!) : null;

  const verification = await verifyWebhook(req, rawBody);
  const receivedAtIso = new Date().toISOString();
  const eventIdSeed =
    req.headers.get("x-zoho-event-id") ||
    req.headers.get("x-request-id") ||
    `${requestId || "no-request-id"}:${eventType || "no-event"}:${receivedAtIso}`;
  const eventId = await sha256Hex(eventIdSeed);

  try {
    if (supabase) {
      await supabase.from("zoho_webhook_events").upsert(
        {
          event_id: eventId,
          method: req.method,
          path: new URL(req.url).pathname,
          query: Object.fromEntries(new URL(req.url).searchParams.entries()),
          headers: {
            "content-type": req.headers.get("content-type"),
            "x-zoho-signature": req.headers.get("x-zoho-signature"),
            "x-zoho-webhook-secret": req.headers.get("x-zoho-webhook-secret") ? "***" : null,
          },
          payload,
          raw_body: rawBody,
          processed: false,
          processing_error: verification.ok ? null : verification.reason,
        },
        { onConflict: "event_id", ignoreDuplicates: false },
      );
    }
  } catch (loggingError) {
    console.error("[zoho-webhook] failed to persist raw event", loggingError);
  }

  if (!verification.ok) {
    console.warn("[zoho-webhook] webhook verification failed:", verification.reason);
    return jsonResponse({
      ok: true,
      accepted: false,
      reason: verification.reason,
    });
  }

  try {
    if (!supabase) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }

    if (requestId) {
      const updatePayload: JsonObject = {
        raw_webhook_payload: payload,
        updated_at: receivedAtIso,
      };
      if (mappedStatus) updatePayload.status = mappedStatus;
      if (recipientEmail) updatePayload.email = recipientEmail;

      const { error: updateError } = await supabase
        .from("zoho_sign_requests")
        .update(updatePayload)
        .eq("request_id", requestId);

      if (updateError) {
        throw updateError;
      }
    } else {
      console.warn("[zoho-webhook] request_id missing in payload");
    }

    await supabase
      .from("zoho_webhook_events")
      .update({
        processed: true,
        processed_at: receivedAtIso,
        processing_error: null,
      })
      .eq("event_id", eventId);
  } catch (processingError) {
    console.error("[zoho-webhook] processing failed", processingError);
    try {
      if (supabase) {
        await supabase
          .from("zoho_webhook_events")
          .update({
            processed: false,
            processed_at: receivedAtIso,
            processing_error:
              processingError instanceof Error ? processingError.message : String(processingError),
          })
          .eq("event_id", eventId);
      }
    } catch (logUpdateError) {
      console.error("[zoho-webhook] failed to persist processing error", logUpdateError);
    }
  }

  return jsonResponse({
    ok: true,
    request_id: requestId,
    event_type: eventType,
    status: mappedStatus,
    recipient_email: recipientEmail,
  });
});

