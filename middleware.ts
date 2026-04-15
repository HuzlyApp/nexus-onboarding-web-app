import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env";

/**
 * Refreshes Supabase Auth cookies and optionally blocks unauthenticated access to recruiter admin UI.
 *
 * Enable strict checks with `ADMIN_RBAC_ENFORCE=true` (or automatically in production when env is set).
 */
export async function middleware(request: NextRequest) {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  const response = NextResponse.next({ request });

  if (!url || !anon) {
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /** UI guard is opt-in so production deploys are not locked out before Supabase Auth is wired. */
  const enforceUi =
    process.env.ADMIN_RBAC_ENFORCE === "true" || process.env.NEXT_PUBLIC_ADMIN_AUTH_REQUIRED === "true";

  if (enforceUi && !user && request.nextUrl.pathname.startsWith("/admin_recruiter")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/admin_recruiter/:path*"],
};
