// @ts-expect-error - Deno URL imports are resolved at Edge runtime.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error - Deno URL imports are resolved at Edge runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
declare const Deno: { env: { get: (name: string) => string | undefined } };

type SendAgreementInput = {
  name?: string;
  email?: string;
  user_id?: string | null;
  project_id?: string | null;
};

type ZohoTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type ZohoTemplateDetailsResponse = {
  status?: string;
  message?: string;
  templates?: {
    template_name?: string;
    actions?: Array<{
      action_id?: string;
      action_type?: string;
      role?: string;
    }>;
  };
};

type ZohoCreateFromTemplateResponse = {
  status?: string;
  message?: string;
  requests?: {
    request_id?: string;
    document_ids?: Array<{ document_id?: string }>;
    actions?: Array<{
      recipient_email?: string;
      action_url?: string;
      sign_url?: string;
    }>;
  };
};

type ErrorStage =
  | "cors"
  | "request_validation"
  | "env_validation"
  | "zoho_token"
  | "zoho_send"
  | "zoho_parse"
  | "db_insert"
  | "unknown";

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

const REQUIRED_ENVS = [
  "ZOHO_SIGN_TEMPLATE_ID",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

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

function getEnv(name: (typeof REQUIRED_ENVS)[number]): string {
  return Deno.env.get(name)?.trim() || "";
}

function getZohoClientId(): string {
  return (
    Deno.env.get("ZOHO_SIGN_CLIENT_ID")?.trim() ||
    Deno.env.get("ZOHO_CLIENT_ID")?.trim() ||
    ""
  );
}

function getZohoClientSecret(): string {
  return (
    Deno.env.get("ZOHO_SIGN_CLIENT_SECRET")?.trim() ||
    Deno.env.get("ZOHO_CLIENT_SECRET")?.trim() ||
    ""
  );
}

function getZohoRefreshToken(): string {
  return (
    Deno.env.get("ZOHO_SIGN_REFRESH_TOKEN")?.trim() ||
    Deno.env.get("ZOHO_REFRESH_TOKEN")?.trim() ||
    ""
  );
}

function getZohoAccountsHost(): string {
  return (
    Deno.env.get("ZOHO_ACCOUNTS_HOST")?.trim() ||
    Deno.env.get("ZOHO_ACCOUNTS_BASE_URL")?.trim() ||
    "https://accounts.zoho.com"
  );
}

function getZohoApiBaseCandidates(): string[] {
  const configured = [
    Deno.env.get("ZOHO_SIGN_API_BASE")?.trim() || "",
    Deno.env.get("ZOHO_SIGN_BASE_URL")?.trim() || "",
  ].filter(Boolean);
  const defaults = ["https://sign.zoho.com", "https://www.zoho.com"];
  return [...new Set([...configured, ...defaults])].map((value) => value.replace(/\/$/, ""));
}

function logEnvAvailability() {
  const availability = {
    ZOHO_SIGN_TEMPLATE_ID: Boolean(getEnv("ZOHO_SIGN_TEMPLATE_ID")),
    SUPABASE_URL: Boolean(getEnv("SUPABASE_URL")),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(getEnv("SUPABASE_SERVICE_ROLE_KEY")),
    ZOHO_SIGN_CLIENT_ID_OR_ZOHO_CLIENT_ID: Boolean(getZohoClientId()),
    ZOHO_SIGN_CLIENT_SECRET_OR_ZOHO_CLIENT_SECRET: Boolean(getZohoClientSecret()),
    ZOHO_SIGN_REFRESH_TOKEN_OR_ZOHO_REFRESH_TOKEN: Boolean(getZohoRefreshToken()),
    ZOHO_ACCOUNTS_HOST_OR_ZOHO_ACCOUNTS_BASE_URL: Boolean(getZohoAccountsHost()),
    ZOHO_SIGN_API_BASE_OR_ZOHO_SIGN_BASE_URL: Boolean(getZohoApiBaseCandidates()[0]),
  };
  console.log("[send-agreement] env availability", availability);
}

async function fetchZohoAccessToken(): Promise<{
  ok: boolean;
  accessToken?: string;
  status: number;
  body: string;
}> {
  const tokenUrl = `${getZohoAccountsHost().replace(/\/$/, "")}/oauth/v2/token`;
  const body = new URLSearchParams({
    refresh_token: getZohoRefreshToken(),
    client_id: getZohoClientId(),
    client_secret: getZohoClientSecret(),
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
    // parse handled by caller stage.
  }

  console.log("[send-agreement] zoho token response status", response.status);

  if (!response.ok || !parsed.access_token) {
    return { ok: false, status: response.status, body: rawBody };
  }
  return { ok: true, status: response.status, body: rawBody, accessToken: parsed.access_token };
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

serve(async (req) => {
  console.log("[send-agreement] request method", req.method);

  if (req.method === "OPTIONS") {
    console.log("[send-agreement] final stage before return", "cors_preflight");
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return fail("cors", "Method not allowed. Use POST.", 405);
  }

  logEnvAvailability();
  const missingEnvVars: string[] = REQUIRED_ENVS.filter((name) => !getEnv(name));
  if (!getZohoClientId()) missingEnvVars.push("ZOHO_SIGN_CLIENT_ID|ZOHO_CLIENT_ID");
  if (!getZohoClientSecret()) missingEnvVars.push("ZOHO_SIGN_CLIENT_SECRET|ZOHO_CLIENT_SECRET");
  if (!getZohoRefreshToken()) missingEnvVars.push("ZOHO_SIGN_REFRESH_TOKEN|ZOHO_REFRESH_TOKEN");
  if (missingEnvVars.length > 0) {
    return fail("env_validation", "Missing required environment variables", 500, {
      missing: missingEnvVars,
    });
  }

  let body: SendAgreementInput;
  try {
    const raw = await req.text();
    body = JSON.parse(raw || "{}") as SendAgreementInput;
  } catch (error) {
    console.error("[send-agreement] request parse error", error);
    return fail("request_validation", "Invalid JSON body", 400);
  }

  console.log("[send-agreement] parsed request body", {
    has_name: Boolean(body?.name?.trim()),
    email: body?.email ? normalizeEmail(body.email) : "",
    has_user_id: Boolean(body?.user_id),
    has_project_id: Boolean(body?.project_id),
  });

  const name = (body.name || "").trim();
  const email = normalizeEmail(body.email || "");
  const userId = body.user_id?.trim() || null;
  const projectId = body.project_id?.trim() || null;

  if (!name || !email) {
    return fail("request_validation", "name and email are required", 400);
  }
  if (!isValidEmail(email)) {
    return fail("request_validation", "email format is invalid", 400);
  }

  const templateName = "Onboarding Agreement";
  const templateId = getEnv("ZOHO_SIGN_TEMPLATE_ID");
  const zohoApiBases = getZohoApiBaseCandidates();

  let accessToken = "";
  try {
    const tokenResult = await fetchZohoAccessToken();
    if (!tokenResult.ok || !tokenResult.accessToken) {
      console.error("[send-agreement] zoho token failure body", tokenResult.body);
      return fail("zoho_token", "Failed to fetch Zoho access token", 502, {
        status: tokenResult.status,
      });
    }
    accessToken = tokenResult.accessToken;
  } catch (error) {
    console.error("[send-agreement] zoho token exception", error);
    return fail("zoho_token", "Failed to fetch Zoho access token", 502);
  }

  let signerActionId = "";
  let activeZohoBase = zohoApiBases[0];
  try {
    let templateFound = false;
    let lastZohoFailure: { base: string; status: number; message?: string; code?: unknown } | null = null;
    let sawJsonFailure = false;
    const templateAttemptDebug: Array<{
      base: string;
      status: number;
      content_type: string | null;
      body_preview: string;
      parseable_json: boolean;
    }> = [];
    for (const candidateBase of zohoApiBases) {
      const templateRes = await zohoRequest(
        candidateBase,
        `/api/v1/templates/${encodeURIComponent(templateId)}`,
        accessToken,
      );
      const templateBody = await templateRes.text();
      const contentType = templateRes.headers.get("content-type");
      console.log("[send-agreement] zoho template response status", templateRes.status);
      console.log("[send-agreement] zoho template response body", templateBody);

      let templateJson: ZohoTemplateDetailsResponse = {};
      let parseableJson = true;
      try {
        templateJson = JSON.parse(templateBody) as ZohoTemplateDetailsResponse;
      } catch {
        parseableJson = false;
        templateAttemptDebug.push({
          base: candidateBase,
          status: templateRes.status,
          content_type: contentType,
          body_preview: templateBody.slice(0, 180),
          parseable_json: false,
        });
        continue;
      }
      templateAttemptDebug.push({
        base: candidateBase,
        status: templateRes.status,
        content_type: contentType,
        body_preview: templateBody.slice(0, 180),
        parseable_json: parseableJson,
      });

      if (!templateRes.ok || templateJson.status !== "success") {
        sawJsonFailure = true;
        const templateJsonWithCode = templateJson as ZohoTemplateDetailsResponse & { code?: unknown };
        lastZohoFailure = {
          base: candidateBase,
          status: templateRes.status,
          message: templateJson.message || "Unknown Zoho error",
          code: templateJsonWithCode.code,
        };
        continue;
      }

      const actions = templateJson.templates?.actions || [];
      signerActionId =
        actions.find(
          (action) =>
            (action.role || "").trim().toLowerCase() === "signer" &&
            (action.action_type || "").trim().toUpperCase() === "SIGN",
        )?.action_id?.trim() ||
        "";

      if (!signerActionId) {
        return fail(
          "zoho_send",
          'Template is missing SIGN action for role "Signer"',
          400,
        );
      }

      activeZohoBase = candidateBase;
      templateFound = true;
      break;
    }

    if (!templateFound) {
      if (sawJsonFailure && lastZohoFailure) {
        return fail("zoho_send", "Zoho template lookup failed", 502, {
          ...lastZohoFailure,
          attempts: templateAttemptDebug,
        });
      }
      return fail("zoho_parse", "Failed to parse Zoho template response", 502, {
        tried_bases: zohoApiBases,
        attempts: templateAttemptDebug,
      });
    }
  } catch (error) {
    console.error("[send-agreement] zoho template exception", error);
    return fail("zoho_send", "Failed while validating Zoho template", 502);
  }

  const zohoPayload = {
    templates: {
      request_name: `${templateName} - ${name}`,
      notes: "",
      field_data: {
        field_text_data: {},
        field_boolean_data: {},
        field_date_data: {},
      },
      actions: [
        {
          action_id: signerActionId,
          role: "Signer",
          action_type: "SIGN",
          recipient_name: name,
          recipient_email: email,
          verify_recipient: false,
          verification_type: "EMAIL",
          is_embedded: false,
        },
      ],
    },
  };

  let zohoJson: ZohoCreateFromTemplateResponse = {};
  try {
    const createBody = new URLSearchParams({ data: JSON.stringify(zohoPayload) });
    const zohoRes = await zohoRequest(
      activeZohoBase,
      `/api/v1/templates/${encodeURIComponent(templateId)}/createdocument?is_quicksend=true`,
      accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: createBody.toString(),
      },
    );
    const zohoText = await zohoRes.text();

    console.log("[send-agreement] zoho send response status", zohoRes.status);
    console.log("[send-agreement] zoho send response body", zohoText);

    try {
      zohoJson = JSON.parse(zohoText) as ZohoCreateFromTemplateResponse;
    } catch {
      return fail("zoho_parse", "Failed to parse Zoho send response", 502);
    }

    if (!zohoRes.ok || zohoJson.status !== "success") {
      return fail("zoho_send", "Zoho template send failed", 502, {
        status: zohoRes.status,
      });
    }
  } catch (error) {
    console.error("[send-agreement] zoho send exception", error);
    return fail("zoho_send", "Failed to send agreement to Zoho", 502);
  }

  const requestId = zohoJson.requests?.request_id?.trim();
  if (!requestId) {
    return fail("zoho_parse", "Zoho response missing request_id", 502);
  }

  const supabase = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

  try {
    const nowIso = new Date().toISOString();
    const { error: insertError } = await supabase.from("zoho_sign_requests").upsert(
      {
        request_id: requestId,
        email,
        recipient_name: name,
        user_id: userId,
        project_id: projectId,
        template_name: templateName,
        status: "sent",
        source: "onboarding",
        raw_send_response: zohoJson,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "request_id", ignoreDuplicates: false },
    );

    if (insertError) {
      console.error("[send-agreement] supabase insert error", insertError);
      return fail("db_insert", "Failed to save record in zoho_sign_requests", 500, {
        message: insertError.message,
      });
    }
  } catch (error) {
    console.error("[send-agreement] supabase insert exception", error);
    return fail("db_insert", "Database operation failed", 500);
  }

  console.log("[send-agreement] final stage before return", "success");
  return jsonResponse({
    success: true,
    request_id: requestId,
    status: "sent",
    email,
    name,
  });
});
