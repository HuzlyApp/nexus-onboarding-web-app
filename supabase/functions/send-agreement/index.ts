// @ts-expect-error - Deno URL imports are resolved at Edge runtime.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error - Deno URL imports are resolved at Edge runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-expect-error - Deno URL imports are resolved at Edge runtime.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

declare const Deno: { env: { get: (name: string) => string | undefined } };

type SendAgreementInput = {
  name?: string;
  email?: string;
  user_id?: string | null;
  project_id?: string | null;
  onboarding_id?: string | null;
  host?: string | null;
  request_id?: string | null;
  action_id?: string | null;
};

type ZohoTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type ZohoCreateRequestResponse = {
  status?: string;
  code?: unknown;
  message?: string;
  requests?: {
    request_id?: string;
    document_id?: string;
    document_ids?: Array<{ document_id?: string }>;
    actions?: Array<{
      action_id?: string;
      action_type?: string;
      recipient_email?: string;
    }>;
  };
};

type ZohoEmbedTokenResponse = {
  status?: string;
  code?: unknown;
  message?: string;
  sign_url?: string;
};

type ZohoGetRequestResponse = {
  status?: string;
  message?: string;
  requests?: {
    request_id?: string;
    request_status?: string;
    document_id?: string;
    document_ids?: Array<{ document_id?: string }>;
    actions?: Array<{
      action_id?: string;
      action_type?: string;
      recipient_email?: string;
    }>;
  };
};

type ErrorStage =
  | "cors"
  | "request_validation"
  | "env_validation"
  | "duplicate_email"
  | "zoho_token"
  | "zoho_send"
  | "zoho_parse"
  | "db_insert";

type ErrorResponse = {
  success: false;
  stage: ErrorStage;
  message: string;
  details?: unknown;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function fail(stage: ErrorStage, message: string, status: number, details?: unknown): Response {
  const payload: ErrorResponse = { success: false, stage, message };
  if (details !== undefined) payload.details = details;
  console.error("[send-agreement] returning error", { stage, status, message, details });
  return jsonResponse(payload, status);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function env(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return "";
}

function getZohoApiBase(): string {
  const configured = env("ZOHO_SIGN_API_BASE", "ZOHO_SIGN_BASE_URL");
  if (!configured) return "https://sign.zoho.com";
  const normalized = configured.replace(/\/$/, "").trim();
  if (/^https?:\/\/www\.zoho\.com$/i.test(normalized)) {
    return "https://sign.zoho.com";
  }
  return normalized;
}

function getZohoAccountsHost(): string {
  return env("ZOHO_ACCOUNTS_HOST", "ZOHO_ACCOUNTS_BASE_URL") || "https://accounts.zoho.com";
}

function resolveEmbedHost(bodyHost?: string | null): string {
  const host = (
    bodyHost?.trim() ||
    env("ZOHO_SIGN_EMBED_HOST", "NEXT_PUBLIC_APP_URL", "PUBLIC_APP_URL", "APP_URL") ||
    "https://hr.nexusmedpro.com"
  ).replace(/\/$/, "");
  if (!host) {
    throw new Error("Missing embedded signing host. Set ZOHO_SIGN_EMBED_HOST or pass host in request body.");
  }
  if (!/^https:\/\//i.test(host)) {
    throw new Error(`Embedded signing host must use https. Received "${host}".`);
  }
  return host;
}

function buildRedirectPages(host: string) {
  return {
    sign_success: env("ZOHO_SIGN_REDIRECT_SUCCESS") || `${host}/sign/success`,
    sign_completed: env("ZOHO_SIGN_REDIRECT_COMPLETED") || `${host}/sign/completed`,
    sign_declined: env("ZOHO_SIGN_REDIRECT_DECLINED") || `${host}/sign/declined`,
    sign_later: env("ZOHO_SIGN_REDIRECT_LATER") || `${host}/sign/later`,
  };
}

async function fetchZohoAccessToken(): Promise<string> {
  const clientId = env("ZOHO_SIGN_CLIENT_ID", "ZOHO_CLIENT_ID");
  const clientSecret = env("ZOHO_SIGN_CLIENT_SECRET", "ZOHO_CLIENT_SECRET");
  const refreshToken = env("ZOHO_SIGN_REFRESH_TOKEN", "ZOHO_REFRESH_TOKEN");
  const accountsHost = getZohoAccountsHost().replace(/\/$/, "");

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Zoho OAuth configuration.");
  }

  const tokenUrl = `${accountsHost}/oauth/v2/token`;
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const rawBody = await response.text();
  let parsed: ZohoTokenResponse = {};
  try {
    parsed = JSON.parse(rawBody) as ZohoTokenResponse;
  } catch {
    throw new Error(`Zoho OAuth response was not JSON (HTTP ${response.status}).`);
  }

  if (!response.ok || !parsed.access_token) {
    throw new Error(parsed.error_description || parsed.error || rawBody || `HTTP ${response.status}`);
  }
  return parsed.access_token;
}

async function loadAgreementPdf(): Promise<Uint8Array> {
  const remoteUrl = env("AUTHORIZATION_PDF_URL");
  if (remoteUrl) {
    const response = await fetch(remoteUrl, { method: "GET" });
    if (response.ok) {
      return new Uint8Array(await response.arrayBuffer());
    }
    console.warn("[send-agreement] AUTHORIZATION_PDF_URL fetch failed, generating fallback PDF", {
      status: response.status,
    });
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText("Agreement", { x: 60, y: 730, size: 24, font, color: rgb(0, 0, 0) });
  page.drawText("This is a sample agreement for testing purposes.", {
    x: 60,
    y: 690,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText("Please sign below.", { x: 60, y: 670, size: 12, font, color: rgb(0, 0, 0) });
  page.drawText("Sign Here: ______________________", {
    x: 60,
    y: 620,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  page.drawText("Date: __________________________", {
    x: 60,
    y: 595,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });
  return await pdfDoc.save();
}

async function zohoRequest(base: string, path: string, accessToken: string, init?: RequestInit): Promise<Response> {
  return await fetch(`${base}${path}`, {
    method: init?.method || "GET",
    headers: {
      ...(init?.headers || {}),
      Authorization: `Zoho-oauthtoken ${accessToken}`,
    },
    body: init?.body,
  });
}

async function createEmbedSignUrl(params: {
  requestId: string;
  actionId: string;
  host: string;
  accessToken: string;
  zohoApiBase: string;
}) {
  const embedRes = await zohoRequest(
    params.zohoApiBase,
    `/api/v1/requests/${encodeURIComponent(params.requestId)}/actions/${encodeURIComponent(params.actionId)}/embedtoken`,
    params.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ host: params.host }).toString(),
    },
  );
  const embedText = await embedRes.text();
  let embedJson: ZohoEmbedTokenResponse = {};
  try {
    embedJson = JSON.parse(embedText) as ZohoEmbedTokenResponse;
  } catch {
    throw new Error("Zoho embedtoken response could not be parsed.");
  }

  if (!embedRes.ok || embedJson.status !== "success" || !embedJson.sign_url) {
    throw new Error(embedJson.message || embedText || `Zoho embedtoken failed (${embedRes.status}).`);
  }

  return embedJson.sign_url.trim();
}

async function getZohoRequestDetails(params: {
  requestId: string;
  accessToken: string;
  zohoApiBase: string;
  preferredActionId?: string;
  recipientEmail?: string;
}): Promise<{ actionId: string; documentId: string | null; requestStatus: string | null }> {
  const detailsRes = await zohoRequest(
    params.zohoApiBase,
    `/api/v1/requests/${encodeURIComponent(params.requestId)}`,
    params.accessToken,
  );
  const detailsText = await detailsRes.text();
  let detailsJson: ZohoGetRequestResponse = {};
  try {
    detailsJson = JSON.parse(detailsText) as ZohoGetRequestResponse;
  } catch {
    throw new Error("Zoho request details response could not be parsed.");
  }

  if (!detailsRes.ok || detailsJson.status !== "success") {
    throw new Error(detailsJson.message || detailsText || `Zoho get request failed (${detailsRes.status}).`);
  }

  const request = detailsJson.requests || {};
  const actions = request.actions || [];
  const targetEmail = (params.recipientEmail || "").toLowerCase();
  const actionId =
    params.preferredActionId?.trim() ||
    actions.find((a) => (a.recipient_email || "").trim().toLowerCase() === targetEmail)?.action_id?.trim() ||
    actions.find((a) => (a.action_type || "").trim().toUpperCase() === "SIGN")?.action_id?.trim() ||
    actions[0]?.action_id?.trim() ||
    "";
  const documentId =
    request.document_id?.trim() ||
    request.document_ids?.[0]?.document_id?.trim() ||
    null;
  const requestStatus = request.request_status?.trim() || null;
  return { actionId, documentId, requestStatus };
}

async function ensureSignerFields(params: {
  requestId: string;
  actionId: string;
  documentId: string;
  accessToken: string;
  zohoApiBase: string;
}) {
  const submitPayload = {
    requests: {
      actions: [
        {
          action_id: params.actionId,
          action_type: "SIGN",
          fields: [
            {
              field_type_name: "Signature",
              action_id: params.actionId,
              document_id: params.documentId,
              field_name: "sign_here",
              field_label: "Sign Here",
              field_category: "image",
              page_no: 0,
              x_value: "56.0",
              y_value: "79.5",
              width: "28.0",
              height: "3.0",
            },
            {
              field_type_name: "Date",
              action_id: params.actionId,
              document_id: params.documentId,
              field_name: "date_signed",
              field_label: "Date",
              field_category: "text",
              page_no: 0,
              x_value: "56.0",
              y_value: "84.2",
              width: "28.0",
              height: "2.5",
            },
          ],
        },
      ],
    },
  };

  const submitRes = await zohoRequest(
    params.zohoApiBase,
    `/api/v1/requests/${encodeURIComponent(params.requestId)}/submit`,
    params.accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: JSON.stringify(submitPayload) }).toString(),
    },
  );
  if (!submitRes.ok) {
    const responseBody = await submitRes.text();
    throw new Error(`Zoho submit failed while ensuring signer fields (${submitRes.status}): ${responseBody}`);
  }
}

function normalizeSigningStatus(status: string | null | undefined): string {
  const s = (status || "").trim().toLowerCase();
  if (!s) return "sent";
  if (s === "in_progress") return "viewed";
  return s;
}

function isFinalizedStatus(status: string | null | undefined): boolean {
  const s = normalizeSigningStatus(status);
  return s === "signed" || s === "completed";
}

function mapZohoRequestStatusToDb(status: string | null | undefined): string {
  const s = (status || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!s) return "sent";
  if (s.includes("complete")) return "completed";
  if (/declin|reject|recall|expir/.test(s)) return "declined";
  if (s.includes("view")) return "viewed";
  if ((/\bsigned\b/.test(s) || s.includes("partially_signed")) && !s.includes("unsigned")) return "signed";
  if (s.includes("awaiting_signature")) return "awaiting_signature";
  if (s.includes("pending")) return "pending";
  return "sent";
}

function isMissingColumnError(message: string): boolean {
  return /column .* does not exist/i.test(message) || /could not find .* column .* in the schema cache/i.test(message);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return fail("cors", "Method not allowed. Use POST.", 405);
  }

  const supabaseUrl = env("SUPABASE_URL");
  const serviceRole = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    return fail("env_validation", "Missing Supabase service role configuration.", 500);
  }

  const zohoApiBase = getZohoApiBase().replace(/\/$/, "");
  const zohoAccountsHost = getZohoAccountsHost();
  if (!zohoApiBase || !zohoAccountsHost) {
    return fail("env_validation", "Missing Zoho host configuration.", 500);
  }

  let body: SendAgreementInput;
  try {
    body = (await req.json()) as SendAgreementInput;
  } catch {
    return fail("request_validation", "Invalid JSON body.", 400);
  }

  const name = (body.name || "").trim();
  const email = normalizeEmail(body.email || "");
  const userId = body.user_id?.trim() || null;
  const projectId = body.project_id?.trim() || null;
  const onboardingId = body.onboarding_id?.trim() || projectId || null;
  const existingRequestId = body.request_id?.trim() || "";
  const existingActionId = body.action_id?.trim() || "";

  if (!name || !email) {
    return fail("request_validation", "name and email are required", 400);
  }
  if (!isValidEmail(email)) {
    return fail("request_validation", "email format is invalid", 400);
  }

  let embedHost = "";
  try {
    embedHost = resolveEmbedHost(body.host);
  } catch (error) {
    return fail("request_validation", error instanceof Error ? error.message : "Invalid host", 400);
  }

  const supabase = createClient(supabaseUrl, serviceRole);

  let accessToken = "";
  try {
    accessToken = await fetchZohoAccessToken();
  } catch (error) {
    console.error("[send-agreement] zoho token error", error);
    return fail("zoho_token", "Failed to fetch Zoho access token", 502, {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (existingRequestId && existingActionId) {
    try {
      const details = await getZohoRequestDetails({
        requestId: existingRequestId,
        accessToken,
        zohoApiBase,
        preferredActionId: existingActionId,
        recipientEmail: email,
      });
      const resolvedActionId = details.actionId || existingActionId;
      const resolvedStatus = details.requestStatus ? mapZohoRequestStatusToDb(details.requestStatus) : "sent";
      if (!resolvedActionId) {
        return fail("zoho_parse", "Could not resolve signer action_id for existing request.", 502);
      }
      if (isFinalizedStatus(resolvedStatus)) {
        return jsonResponse({
          success: true,
          request_id: existingRequestId,
          action_id: resolvedActionId,
          sign_url: null,
          signing_url: null,
          status: resolvedStatus,
          email,
          name,
        });
      }
      if (details.documentId) {
        try {
          await ensureSignerFields({
            requestId: existingRequestId,
            actionId: resolvedActionId,
            documentId: details.documentId,
            accessToken,
            zohoApiBase,
          });
        } catch (ensureError) {
          console.warn("[send-agreement] could not re-apply signer fields on existing request", {
            request_id: existingRequestId,
            action_id: resolvedActionId,
            error: ensureError instanceof Error ? ensureError.message : String(ensureError),
          });
        }
      }

      const signUrl = await createEmbedSignUrl({
        requestId: existingRequestId,
        actionId: resolvedActionId,
        host: embedHost,
        accessToken,
        zohoApiBase,
      });
      await supabase
        .from("zoho_sign_requests")
        .update({
          action_id: resolvedActionId,
          status: resolvedStatus,
          sign_url: signUrl,
          signing_url: signUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("request_id", existingRequestId);

      return jsonResponse({
        success: true,
        request_id: existingRequestId,
        action_id: resolvedActionId,
        sign_url: signUrl,
        signing_url: signUrl,
        status: resolvedStatus,
        email,
        name,
      });
    } catch (error) {
      return fail("zoho_send", "Could not refresh embedded signing URL.", 502, {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const { data: existingRows, error: dupLookupError } = await supabase
    .from("zoho_sign_requests")
    .select("request_id,status")
    .eq("source", "onboarding")
    .eq("email", email)
    .neq("status", "declined")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (dupLookupError) {
    return fail("request_validation", "Could not verify duplicate onboarding agreement.", 500, {
      message: dupLookupError.message,
    });
  }

  if (existingRows && existingRows.length > 0) {
    const first = existingRows[0];
    const existingId = first.request_id?.trim() || "";
    const existingStatus = normalizeSigningStatus(first.status || "sent");
    const existingAction = "";

    if (existingId) {
      if (isFinalizedStatus(existingStatus)) {
        return jsonResponse({
          success: true,
          request_id: existingId,
          action_id: existingAction || null,
          status: existingStatus,
          email,
          name,
          sign_url: null,
          signing_url: null,
        });
      }

      try {
        const details = await getZohoRequestDetails({
          requestId: existingId,
          accessToken,
          zohoApiBase,
          preferredActionId: existingAction || undefined,
          recipientEmail: email,
        });
        const resolvedActionId = details.actionId || existingAction;
        if (!resolvedActionId) {
          return fail("zoho_parse", "Could not resolve signer action_id for existing request.", 502);
        }

        const resolvedStatus = details.requestStatus
          ? mapZohoRequestStatusToDb(details.requestStatus)
          : existingStatus;
        if (isFinalizedStatus(resolvedStatus)) {
          return jsonResponse({
            success: true,
            request_id: existingId,
            action_id: resolvedActionId,
            status: resolvedStatus,
            email,
            name,
            sign_url: null,
            signing_url: null,
          });
        }

        if (details.documentId) {
          try {
            await ensureSignerFields({
              requestId: existingId,
              actionId: resolvedActionId,
              documentId: details.documentId,
              accessToken,
              zohoApiBase,
            });
          } catch (ensureError) {
            console.warn("[send-agreement] could not ensure signer fields on existing active request", {
              request_id: existingId,
              action_id: resolvedActionId,
              error: ensureError instanceof Error ? ensureError.message : String(ensureError),
            });
          }
        }

        const signUrl = await createEmbedSignUrl({
          requestId: existingId,
          actionId: resolvedActionId,
          host: embedHost,
          accessToken,
          zohoApiBase,
        });

        await supabase
          .from("zoho_sign_requests")
          .update({
            action_id: resolvedActionId,
            status: resolvedStatus,
            sign_url: signUrl,
            signing_url: signUrl,
            updated_at: new Date().toISOString(),
          })
          .eq("request_id", existingId);

        return jsonResponse({
          success: true,
          request_id: existingId,
          action_id: resolvedActionId,
          sign_url: signUrl,
          signing_url: signUrl,
          status: resolvedStatus,
          email,
          name,
        });
      } catch (error) {
        return fail("zoho_send", "Failed to continue embedded signing session for existing agreement.", 502, {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  let agreementPdf: Uint8Array;
  try {
    agreementPdf = await loadAgreementPdf();
  } catch (error) {
    return fail("zoho_send", "Unable to load or generate agreement PDF.", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const requestPayload = {
    requests: {
      request_name: `Agreement - ${name}`,
      is_sequential: true,
      expiration_days: 10,
      email_reminders: false,
      actions: [
        {
          recipient_name: name,
          recipient_email: email,
          action_type: "SIGN",
          is_embedded: true,
          verify_recipient: true,
          verification_type: "EMAIL",
        },
      ],
      redirect_pages: buildRedirectPages(embedHost),
    },
  };

  let requestId = "";
  let actionId = "";
  let documentId: string | null = null;
  let rawCreateResponse: ZohoCreateRequestResponse = {};

  try {
    const fd = new FormData();
    fd.append("data", JSON.stringify(requestPayload));
    fd.append("file", new Blob([agreementPdf], { type: "application/pdf" }), "Onboarding Agreement.pdf");

    const createRes = await zohoRequest(zohoApiBase, "/api/v1/requests", accessToken, {
      method: "POST",
      body: fd,
    });
    const createText = await createRes.text();
    try {
      rawCreateResponse = JSON.parse(createText) as ZohoCreateRequestResponse;
    } catch {
      return fail("zoho_parse", "Zoho create request returned non-JSON.", 502);
    }

    if (!createRes.ok || rawCreateResponse.status !== "success") {
      return fail("zoho_send", "Zoho request creation failed.", 502, {
        status: createRes.status,
        zoho_status: rawCreateResponse.status,
        zoho_code: rawCreateResponse.code,
        zoho_message: rawCreateResponse.message,
      });
    }

    requestId = rawCreateResponse.requests?.request_id?.trim() || "";
    const actions = rawCreateResponse.requests?.actions || [];
    actionId =
      actions.find((a) => (a.recipient_email || "").trim().toLowerCase() === email)?.action_id?.trim() ||
      actions.find((a) => (a.action_type || "").trim().toUpperCase() === "SIGN")?.action_id?.trim() ||
      actions[0]?.action_id?.trim() ||
      "";
    const docIds = rawCreateResponse.requests?.document_ids || [];
    documentId =
      rawCreateResponse.requests?.document_id?.trim() ||
      docIds[0]?.document_id?.trim() ||
      null;

    if (!requestId || !actionId || !documentId) {
      return fail("zoho_parse", "Zoho response missing request_id/action_id/document_id.", 502);
    }
  } catch (error) {
    console.error("[send-agreement] zoho create exception", error);
    return fail("zoho_send", "Failed creating Zoho sign request.", 502, {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const submitPayload = {
      requests: {
        actions: [
          {
            action_id: actionId,
            action_type: "SIGN",
            fields: [
              {
                field_type_name: "Signature",
                action_id: actionId,
                document_id: documentId,
                field_name: "sign_here",
                field_label: "Sign Here",
                field_category: "image",
                page_no: 0,
                x_value: "56.0",
                y_value: "79.5",
                width: "28.0",
                height: "3.0",
              },
              {
                field_type_name: "Date",
                action_id: actionId,
                document_id: documentId,
                field_name: "date_signed",
                field_label: "Date",
                field_category: "text",
                page_no: 0,
                x_value: "56.0",
                y_value: "84.2",
                width: "28.0",
                height: "2.5",
              },
            ],
          },
        ],
      },
    };

    const submitRes = await zohoRequest(
      zohoApiBase,
      `/api/v1/requests/${encodeURIComponent(requestId)}/submit`,
      accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: JSON.stringify(submitPayload) }).toString(),
      },
    );
    if (!submitRes.ok) {
      return fail("zoho_send", "Zoho submit failed while adding signature fields.", 502, {
        status: submitRes.status,
        body: await submitRes.text(),
      });
    }
  } catch (error) {
    return fail("zoho_send", "Failed to submit Zoho request.", 502, {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let signUrl = "";
  try {
    signUrl = await createEmbedSignUrl({
      requestId,
      actionId,
      host: embedHost,
      accessToken,
      zohoApiBase,
    });
  } catch (error) {
    return fail("zoho_send", "Failed to generate embedded signing URL.", 502, {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const nowIso = new Date().toISOString();
    let { error: insertError } = await supabase.from("zoho_sign_requests").upsert(
      {
        request_id: requestId,
        action_id: actionId,
        email,
        recipient_name: name,
        user_id: userId,
        project_id: projectId,
        onboarding_id: onboardingId,
        template_name: "Onboarding Agreement",
        status: "sent",
        source: "onboarding",
        zoho_document_id: documentId,
        sign_url: signUrl,
        signing_url: signUrl,
        raw_send_response: rawCreateResponse,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "request_id", ignoreDuplicates: false },
    );

    // Backward compatibility for DBs that have not applied new columns yet.
    if (insertError && isMissingColumnError(insertError.message || "")) {
      const retry = await supabase.from("zoho_sign_requests").upsert(
        {
          request_id: requestId,
          email,
          recipient_name: name,
          user_id: userId,
          project_id: projectId,
          template_name: "Onboarding Agreement",
          status: "sent",
          source: "onboarding",
          zoho_document_id: documentId,
          signing_url: signUrl,
          raw_send_response: rawCreateResponse,
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "request_id", ignoreDuplicates: false },
      );
      insertError = retry.error;
    }

    if (insertError) {
      const msg = insertError.message || "";
      const code = (insertError as { code?: string }).code;
      if (code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
        return fail(
          "duplicate_email",
          "A signing session already exists for this agreement. Please continue with Click and Sign.",
          409,
          { message: msg },
        );
      }
      return fail("db_insert", "Failed to save record in zoho_sign_requests", 500, {
        message: msg,
      });
    }
  } catch (error) {
    return fail("db_insert", "Database operation failed", 500, {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return jsonResponse({
    success: true,
    request_id: requestId,
    action_id: actionId,
    document_id: documentId,
    status: "sent",
    email,
    name,
    sign_url: signUrl,
    signing_url: signUrl,
  });
});
