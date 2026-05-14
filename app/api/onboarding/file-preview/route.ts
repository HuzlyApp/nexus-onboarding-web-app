import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requireOnboardingSessionUser } from "@/lib/auth/api-session"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets"
import { parseStoragePublicUrl } from "@/lib/supabase-storage-url"

export const runtime = "nodejs"

function normalizeRequiredFilePath(pathOrUrl: string): string | null {
  const trimmed = pathOrUrl.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = parseStoragePublicUrl(trimmed)
    if (!parsed || parsed.bucket !== WORKER_REQUIRED_FILES_BUCKET) return null
    return parsed.path
  }

  return trimmed.replace(/^\/+/, "")
}

export async function GET(req: NextRequest) {
  try {
    const applicantId = req.nextUrl.searchParams.get("applicantId")?.trim() || ""
    const pathOrUrl = req.nextUrl.searchParams.get("path")?.trim() || ""

    if (!applicantId || !pathOrUrl) {
      return NextResponse.json({ error: "Missing applicantId or path" }, { status: 400 })
    }

    const sessionUser = await requireOnboardingSessionUser()
    if (sessionUser instanceof NextResponse) return sessionUser
    if (sessionUser.id !== applicantId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const objectPath = normalizeRequiredFilePath(pathOrUrl)
    const allowedPrefix = /^(ssn|license)\//
    if (!objectPath || !allowedPrefix.test(objectPath) || !objectPath.includes(`/${applicantId}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const url = getSupabaseUrl()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
    const { data, error } = await supabase.storage
      .from(WORKER_REQUIRED_FILES_BUCKET)
      .createSignedUrl(objectPath, 60 * 10)

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: error?.message || "Could not create preview URL" }, { status: 500 })
    }

    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
