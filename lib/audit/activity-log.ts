import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type ActivityLogInput = {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
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

  const { error } = await supabase.from("activity_log").insert({
    actor_user_id: input.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
    ip,
    user_agent: userAgent,
  });

  if (error) {
    console.error("[activity_log] insert failed:", error.message);
  }
}
