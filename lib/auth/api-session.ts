import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isStaffRole, parseAppRole, type AppRole } from "@/lib/auth/app-role";
import { resolveAppRoleForUser } from "@/lib/auth/resolve-role";

const DEV_BYPASS_USER = "00000000-0000-0000-0000-000000000001";

export type ApiAuthContext = {
  userId: string;
  email: string | null;
  role: AppRole;
  /** True only when DEV_ADMIN_AUTH_BYPASS is used (local testing). */
  devBypass: boolean;
};

function devBypassAuth(): ApiAuthContext | null {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.DEV_ADMIN_AUTH_BYPASS !== "true") return null;
  return {
    userId: DEV_BYPASS_USER,
    email: null,
    role: parseAppRole(process.env.DEV_IMPERSONATE_ROLE) ?? "admin",
    devBypass: true,
  };
}

/**
 * Authenticated Supabase user for Route Handlers. Returns 401 JSON if unauthenticated.
 * In development, optional `DEV_ADMIN_AUTH_BYPASS=true` yields a synthetic admin (see `.env.example`).
 */
export async function requireApiSession(): Promise<ApiAuthContext | NextResponse> {
  const bypass = devBypassAuth();
  if (bypass) {
    console.warn("[auth] DEV_ADMIN_AUTH_BYPASS active — not for production");
    return bypass;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = await resolveAppRoleForUser(user);
    return {
      userId: user.id,
      email: typeof user.email === "string" ? user.email : null,
      role,
      devBypass: false,
    };
  } catch (e) {
    console.error("[auth] requireApiSession", e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export function requireRole(ctx: ApiAuthContext, allowed: AppRole[]): NextResponse | null {
  if (allowed.includes(ctx.role)) return null;
  return NextResponse.json({ error: "Forbidden", detail: "Insufficient role" }, { status: 403 });
}

/** Recruiter, support, or admin — pipeline / roster APIs. */
export async function requireStaffApiSession(): Promise<ApiAuthContext | NextResponse> {
  const s = await requireApiSession();
  if (s instanceof NextResponse) return s;
  if (!isStaffRole(s.role)) {
    return NextResponse.json({ error: "Forbidden", detail: "Staff role required" }, { status: 403 });
  }
  return s;
}
