import { NextRequest, NextResponse } from "next/server"
import { createClient as createSbAdmin } from "@supabase/supabase-js"
import { createClient as createSbServer } from "@/lib/supabase/server"
import { getSupabaseUrl } from "@/lib/supabase-env"

export const runtime = "nodejs"

type Body = { applicantId: string }

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body
    const applicantId = typeof body?.applicantId === "string" ? body.applicantId.trim() : ""
    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }

    // Verify the caller is the same authenticated user (prevents arbitrary role escalation).
    const sb = await createSbServer()
    const { data: authData, error: authErr } = await sb.auth.getUser()
    if (authErr || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    if (authData.user.id !== applicantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = getSupabaseUrl()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const admin = createSbAdmin(url, serviceKey, { auth: { persistSession: false } })

    const { data, error } = await admin.auth.admin.updateUserById(applicantId, {
      app_metadata: { role: "super_admin" },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, user: data.user })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

