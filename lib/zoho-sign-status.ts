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
  return statusLabelMap[status] || "Pending";
}

export async function sendAgreement(payload: SendAgreementPayload): Promise<SendAgreementResult> {
  const { data, error } = await supabaseBrowser.functions.invoke("send-agreement", { body: payload });

  if (!error && data?.success) {
    return data as SendAgreementResult;
  }

  if (error) {
    const context = (error as Error & { context?: Response }).context;
    if (context) {
      try {
        const body = (await context.json()) as {
          success?: boolean;
          stage?: string;
          message?: string;
          details?: unknown;
        };
        const stageText = body.stage ? `[${body.stage}] ` : "";
        const detailsText =
          body.details && typeof body.details === "object" ? ` ${JSON.stringify(body.details)}` : "";
        throw new Error(`${stageText}${body.message || error.message || "send-agreement failed"}${detailsText}`);
      } catch {
        // Fall through to generic error below.
      }
    }
  }

  throw new Error(error?.message || "Failed to call send-agreement");
}

export async function fetchZohoSignStatus(params: {
  requestId?: string;
  email?: string;
}): Promise<ZohoSignRequestRecord | null> {
  const requestId = params.requestId?.trim();
  const email = params.email?.trim().toLowerCase();
  if (!requestId && !email) return null;

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

export function subscribeToZohoSignStatus(params: {
  requestId: string;
  onStatusChange: (next: ZohoSignRequestRecord) => void;
  onError?: (error: Error) => void;
}) {
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
      (payload) => {
        const next = payload.new as ZohoSignRequestRecord;
        params.onStatusChange(next);
      },
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
