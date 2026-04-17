"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";

export type ZohoSignDbStatus =
  | "sent"
  | "viewed"
  | "signed"
  | "completed"
  | "declined";

export type ZohoSignRequestRecord = {
  request_id: string;
  email: string;
  recipient_name: string | null;
  status: ZohoSignDbStatus;
  created_at: string;
  updated_at: string;
};

export type SendAgreementPayload = {
  name: string;
  email: string;
  user_id?: string;
  project_id?: string;
};

export type SendAgreementResult = {
  success: boolean;
  request_id: string;
  status: ZohoSignDbStatus;
  email: string;
  name: string;
  signing_url?: string | null;
  zoho_document_id?: string | null;
};

const statusLabelMap: Record<ZohoSignDbStatus, string> = {
  sent: "Pending",
  viewed: "Viewed",
  signed: "Signed ✅",
  completed: "Completed 🎉",
  declined: "Declined ❌",
};

export function mapZohoStatusToLabel(status: ZohoSignDbStatus | null | undefined): string {
  if (!status) return "Pending";
  const normalized = String(status).trim().toLowerCase() as ZohoSignDbStatus;
  return statusLabelMap[normalized] || "Pending";
}

export async function sendAgreement(payload: SendAgreementPayload): Promise<SendAgreementResult> {
  const body = {
    ...payload,
    email: payload.email?.trim().toLowerCase() || payload.email,
  };
  const { data, error } = await supabaseBrowser.functions.invoke("send-agreement", { body });

  if (data && typeof data === "object" && "success" in data && (data as { success?: boolean }).success === false) {
    const d = data as { stage?: string; message?: string };
    const msg = d.message || "send-agreement failed";
    throw new Error(d.stage ? `[${d.stage}] ${msg}` : msg);
  }

  if (!error && data?.success) {
    return data as SendAgreementResult;
  }

  if (error) {
    const context = (error as Error & { context?: Response }).context;
    if (context) {
      let parsedBody:
        | {
            success?: boolean;
            stage?: string;
            message?: string;
            details?: unknown;
          }
        | null = null;
      try {
        const text = await context.text();
        parsedBody = JSON.parse(text) as {
          success?: boolean;
          stage?: string;
          message?: string;
          details?: unknown;
        };
      } catch {
        // ignore parse errors
      }

      if (parsedBody) {
        const stageText = parsedBody.stage ? `[${parsedBody.stage}] ` : "";
        const detailsText =
          parsedBody.details && typeof parsedBody.details === "object" ? ` ${JSON.stringify(parsedBody.details)}` : "";
        const composedMessage = `${stageText}${parsedBody.message || error.message || "send-agreement failed"}${detailsText}`;
        throw new Error(composedMessage);
      }
    }
  }

  throw new Error(error?.message || "Failed to call send-agreement");
}

export async function fetchZohoSignStatus(params: {
  requestId?: string;
  email?: string;
  /** When true, server asks Zoho for current `request_status` and updates the DB row (best-effort). */
  reconcile?: boolean;
}): Promise<ZohoSignRequestRecord | null> {
  const requestId = params.requestId?.trim();
  const email = params.email?.trim().toLowerCase();
  if (!requestId && !email) return null;

  const qs = new URLSearchParams();
  if (requestId) qs.set("request_id", requestId);
  if (email) qs.set("email", email);
  if (params.reconcile) qs.set("reconcile", "1");

  try {
    const res = await fetch(`/api/zoho-sign/status?${qs.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    const json = (await res.json()) as {
      success?: boolean;
      error?: string;
      data?: ZohoSignRequestRecord | null;
    };
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Status endpoint failed with ${res.status}`);
    }
    return json.data || null;
  } catch {
    // Fallback to direct client query for environments where server route is unavailable.
    let query = supabaseBrowser
      .from("zoho_sign_requests")
      .select("request_id,email,recipient_name,status,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);
    query = requestId ? query.eq("request_id", requestId) : query.eq("email", email!);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as ZohoSignRequestRecord | null) || null;
  }
}

export function subscribeToZohoSignStatus(params: {
  requestId: string;
  onStatusChange: (next: ZohoSignRequestRecord) => void;
  onError?: (error: Error) => void;
}) {
  const applyPayload = (payload: { new: Record<string, unknown> }) => {
    const row = payload.new as ZohoSignRequestRecord;
    if (row?.request_id && row.request_id !== params.requestId) return;
    params.onStatusChange(row);
  };

  const channel = supabaseBrowser
    .channel(`zoho-sign-${params.requestId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "zoho_sign_requests",
        filter: `request_id=eq.${params.requestId}`,
      },
      applyPayload,
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "zoho_sign_requests",
        filter: `request_id=eq.${params.requestId}`,
      },
      applyPayload,
    )
    .subscribe((status, err) => {
      if (err) {
        params.onError?.(new Error(err.message || "Realtime subscription failed"));
        return;
      }
      if (status === "CHANNEL_ERROR") {
        params.onError?.(new Error("Realtime channel error"));
      }
    });

  return () => {
    void supabaseBrowser.removeChannel(channel);
  };
}
