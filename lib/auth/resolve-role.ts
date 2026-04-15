import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { parseAppRole, type AppRole } from "@/lib/auth/app-role";

/**
 * Resolve `app_role` for a Supabase Auth user: `user_roles` row, else JWT `app_metadata.role`, else `worker`.
 */
export async function resolveAppRoleForUser(user: User): Promise<AppRole> {
  const fromJwt = parseAppRole(
    (user.app_metadata as Record<string, unknown> | undefined)?.role
  );
  const sb = createServiceRoleClient();
  if (sb) {
    const { data, error } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error && data && typeof (data as { role?: string }).role === "string") {
      const r = parseAppRole((data as { role: string }).role);
      if (r) return r;
    }
  }
  return fromJwt ?? "worker";
}
