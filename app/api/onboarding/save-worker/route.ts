import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseUrl } from "@/lib/supabase-env"

export const runtime = "nodejs"

function isMissingColumnErr(e: unknown) {
  const err = e as { code?: string; message?: string } | null
  if (!err) return false
  // Postgres undefined_column
  if (err.code === "42703") return true
  return typeof err.message === "string" && err.message.includes(" does not exist")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const applicantId = typeof body.applicantId === "string" ? body.applicantId.trim() : ""
    if (!applicantId) {
      return NextResponse.json({ error: "Missing applicantId" }, { status: 400 })
    }

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) {
      return NextResponse.json(
        {
          error: "MISSING_SUPABASE_URL",
          hint: "Set NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL in .env.local",
        },
        { status: 503 }
      )
    }
    if (!key) {
      // Client may fall back to anon Supabase client if RLS allows inserts on `worker`.
      return NextResponse.json(
        {
          error: "MISSING_SERVICE_ROLE_KEY",
          hint: "Set SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Project Settings → API → service_role). This is a secret key, not a job title or the worker table.",
        },
        { status: 503 }
      )
    }

    const supabase = createClient(url, key)

    // `user_id` is the stable onboarding key (matches localStorage applicantId, must be a UUID).
    const baseRow = {
      user_id: applicantId,
      first_name: String(body.firstName ?? "").trim(),
      last_name: String(body.lastName ?? "").trim(),
      address1: String(body.address1 ?? "").trim(),
      address2: String(body.address2 ?? "").trim(),
      city: String(body.city ?? "").trim(),
      state: String(body.state ?? "").trim(),
      zip: String(body.zipCode ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      email: String(body.email ?? "").trim(),
      job_role: String(body.jobRole ?? "").trim(),
      updated_at: new Date().toISOString(),
    }

    // Some DBs use `status` while others use `worker_status` (enum, constrained by worker_status_chk).
    // We'll try status first, then worker_status, then omit entirely if neither column exists.
    const rawStatus = String(body.status ?? "").trim()
    const rowAttempts: Record<string, unknown>[] = [
      rawStatus ? { ...baseRow, status: rawStatus } : { ...baseRow },
      rawStatus ? { ...baseRow, worker_status: rawStatus } : { ...baseRow },
      { ...baseRow },
    ]

    // Avoid upsert(..., onConflict: "user_id") — it requires a UNIQUE constraint/index on worker.user_id.
    // Some DBs may not have run the migration yet; update-by-id / insert works everywhere.
    const { data: existingRows, error: selErr } = await supabase
      .from("worker")
      .select("id")
      .eq("user_id", applicantId)
      .limit(1)

    if (selErr) throw selErr
    const existingId = existingRows?.[0]?.id != null ? String(existingRows[0].id) : null

    if (existingId) {
      let lastErr: unknown = null
      for (const attempt of rowAttempts) {
        const { user_id: _u, ...updatePayload } = attempt as Record<string, unknown>
        const { error: upErr } = await supabase.from("worker").update(updatePayload).eq("id", existingId)
        if (!upErr) {
          lastErr = null
          break
        }
        lastErr = upErr
        if (!isMissingColumnErr(upErr)) break
      }
      if (lastErr) {
        const upErr = lastErr as { message?: string; details?: string; hint?: string }
        console.error("[onboarding/save-worker] update", upErr)
        const msg = [upErr.message, upErr.details, upErr.hint].filter(Boolean).join(" — ")
        return NextResponse.json({ error: msg || "Database error" }, { status: 500 })
      }
    } else {
      let lastErr: unknown = null
      for (const attempt of rowAttempts) {
        const { error: insErr } = await supabase.from("worker").insert(attempt)
        if (!insErr) {
          lastErr = null
          break
        }
        lastErr = insErr
        if (!isMissingColumnErr(insErr)) break
      }
      if (lastErr) {
        const insErr = lastErr as { message?: string; details?: string; hint?: string }
        console.error("[onboarding/save-worker] insert", insErr)
        const msg = [insErr.message, insErr.details, insErr.hint].filter(Boolean).join(" — ")
        return NextResponse.json({ error: msg || "Database error" }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error("[onboarding/save-worker]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
