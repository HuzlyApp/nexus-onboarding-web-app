import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ActivityLogInput = {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Required when the DB uses `activity_logs` with a NOT NULL `tenant_id` (multi-tenant). */
  tenantId?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
};

/**
 * Best-effort audit row (service role). Never throws; failures are logged to stderr.
 * Call after successful authorization for sensitive reads/writes.
 */
export async function writeActivityLog(input: ActivityLogInput): Promise<void> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    console.warn("[activity_log] service role not configured; skipping audit");
    return;
  }
  const headers = input.request?.headers;
  const ip =
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers?.get("x-real-ip") ||
    null;
  const userAgent = headers?.get("user-agent") || null;

  const isMissingTableOrColumn = (message: string) =>
    /not find|does not exist|schema cache|column/i.test(message);

  // Live environments use `activity_logs`; older migrations used singular `activity_log`.
  const entityId =
    typeof input.entityId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      input.entityId.trim(),
    )
      ? input.entityId.trim()
      : null;
  const tenantId =
    typeof input.tenantId === "string" && input.tenantId.trim().length > 0
      ? input.tenantId.trim()
      : null;
  const payloadV0: Record<string, unknown> = {
    user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: entityId,
    details: {
      ...(input.metadata ?? {}),
      ip,
      user_agent: userAgent,
    },
  };
  if (tenantId) payloadV0.tenant_id = tenantId;

  let { error: fallbackError } = await supabase.from("activity_logs").insert(payloadV0);
  if (
    fallbackError &&
    tenantId &&
    /tenant_id/i.test(fallbackError.message) &&
    isMissingTableOrColumn(fallbackError.message)
  ) {
    const { tenant_id: _tenantId, ...withoutTenantId } = payloadV0;
    ;({ error: fallbackError } = await supabase.from("activity_logs").insert(withoutTenantId));
  }
  if (!fallbackError) return;

  if (!isMissingTableOrColumn(fallbackError.message)) {
    console.error("[activity_log] insert failed:", fallbackError.message);
    return;
  }

  const payloadV1 = {
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
    ip,
    user_agent: userAgent,
  };

  const { error } = await supabase.from("activity_log").insert(payloadV1);
  if (error) {
    console.error("[activity_log] insert failed:", error.message);
  }
}
