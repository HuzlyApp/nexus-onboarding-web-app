import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { requireStaffApiSession } from "@/lib/auth/api-session"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

const NOTE_ACTION = "worker.note.created"

type NoteRow = {
  id: string | null
  worker_id: string
  body: string
  created_at: string | null
  actor_user_id: string | null
}

function isMissingTableOrColumnError(err: unknown) {
  const message = (err as { message?: unknown } | null)?.message
  const s = typeof message === "string" ? message : ""
  return /not find|does not exist|schema cache|column/i.test(s)
}

function isMissingTableError(err: unknown, tableName: string) {
  const message = (err as { message?: unknown } | null)?.message
  const s = typeof message === "string" ? message : ""
  return (
    s.includes(tableName) &&
    /not find|does not exist|schema cache/i.test(s) &&
    !/column/i.test(s)
  )
}

function noteBodyFromDetails(details: unknown): string {
  if (!details || typeof details !== "object") return ""
  const value = (details as { body?: unknown; note?: unknown; content?: unknown }).body ??
    (details as { note?: unknown }).note ??
    (details as { content?: unknown }).content
  return typeof value === "string" ? value.trim() : ""
}

function mapNoteRow(row: Record<string, unknown>, workerId: string): NoteRow | null {
  const body = noteBodyFromDetails(row.details ?? row.metadata)
  if (!body) return null
  return {
    id: row.id != null ? String(row.id) : null,
    worker_id: workerId,
    body,
    created_at: row.created_at != null ? String(row.created_at) : null,
    actor_user_id:
      row.user_id != null
        ? String(row.user_id)
        : row.actor_user_id != null
          ? String(row.actor_user_id)
          : null,
  }
}

async function loadNotes(supabase: SupabaseClient, workerId: string): Promise<NoteRow[]> {
  const attempts = [
    { table: "activity_logs", detailsColumn: "details" },
    { table: "activity_log", detailsColumn: "metadata" },
  ] as const

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from(attempt.table)
      .select("*")
      .eq("entity_type", "worker")
      .eq("entity_id", workerId)
      .eq("action", NOTE_ACTION)
      .order("created_at", { ascending: false })

    if (error) {
      if (isMissingTableError(error, attempt.table)) continue
      throw error
    }

    return ((data ?? []) as Record<string, unknown>[])
      .map((row) => mapNoteRow(row, workerId))
      .filter((row): row is NoteRow => row != null)
  }

  return []
}

async function getWorkerForNotes(supabase: SupabaseClient, workerId: string) {
  const { data, error } = await supabase
    .from("worker")
    .select("id, tenant_id, first_name, last_name, job_role")
    .eq("id", workerId)
    .maybeSingle()

  if (error) throw error
  return data as Record<string, unknown> | null
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession()
    if (auth instanceof NextResponse) return auth

    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || ""
    const idCheck = parseRequiredUuid(workerIdRaw, "workerId")
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }
    const workerId = idCheck.value

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)
    const worker = await getWorkerForNotes(supabase, workerId)
    if (!worker?.id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    }

    const notes = await loadNotes(supabase, workerId)
    return NextResponse.json({ notes })
  } catch (err: unknown) {
    console.error("[admin/worker-notes] GET", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaffApiSession()
    if (auth instanceof NextResponse) return auth

    const body = (await req.json().catch(() => ({}))) as { workerId?: unknown; body?: unknown }
    const idCheck = parseRequiredUuid(
      typeof body.workerId === "string" ? body.workerId : "",
      "workerId",
    )
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }
    const workerId = idCheck.value
    const noteBody = typeof body.body === "string" ? body.body.trim() : ""
    if (!noteBody) {
      return NextResponse.json({ error: "Note body is required" }, { status: 400 })
    }

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)
    const worker = await getWorkerForNotes(supabase, workerId)
    if (!worker?.id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    }

    const noteDetails = {
      body: noteBody,
      source: "Admin UI",
      worker_id: workerId,
    }
    const actorUserId = auth.devBypass ? null : auth.userId
    const workerTenantId =
      typeof worker.tenant_id === "string" && worker.tenant_id.trim()
        ? worker.tenant_id.trim()
        : null
    const activityLogsPayload: Record<string, unknown> = {
      user_id: actorUserId,
      action: NOTE_ACTION,
      entity_type: "worker",
      entity_id: workerId,
      details: noteDetails,
    }
    if (workerTenantId) activityLogsPayload.tenant_id = workerTenantId

    let { error } = await supabase.from("activity_logs").insert(activityLogsPayload)
    if (
      error &&
      workerTenantId &&
      /tenant_id/i.test(error.message) &&
      isMissingTableOrColumnError(error)
    ) {
      const { tenant_id: _tenantId, ...withoutTenantId } = activityLogsPayload
      ;({ error } = await supabase.from("activity_logs").insert(withoutTenantId))
    }
    if (error && isMissingTableError(error, "activity_logs")) {
      const headers = req.headers
      const ip =
        headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        headers.get("x-real-ip") ||
        null
      const userAgent = headers.get("user-agent") || null
      ;({ error } = await supabase.from("activity_log").insert({
        actor_user_id: actorUserId,
        action: NOTE_ACTION,
        entity_type: "worker",
        entity_id: workerId,
        metadata: noteDetails,
        ip,
        user_agent: userAgent,
      }))
    }

    if (error) {
      return NextResponse.json({ error: error.message || "Could not save note" }, { status: 500 })
    }

    const notes = await loadNotes(supabase, workerId)
    return NextResponse.json({ ok: true, notes })
  } catch (err: unknown) {
    console.error("[admin/worker-notes] POST", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
