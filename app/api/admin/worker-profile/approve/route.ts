import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { writeActivityLog } from "@/lib/audit/activity-log"
import { requireStaffApiSession } from "@/lib/auth/api-session"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

function isMissingColumnErr(err: unknown) {
  const e = err as { code?: string; message?: string } | null
  if (!e) return false
  if (e.code === "42703") return true
  return typeof e.message === "string" && e.message.includes(" does not exist")
}

function isInvalidEnumValueErr(err: unknown) {
  const e = err as { code?: string; message?: string } | null
  if (!e) return false
  if (e.code === "22P02") return true
  return (
    typeof e.message === "string" &&
    e.message.toLowerCase().includes("invalid input value for enum")
  )
}

function canTryNextStatusColumn(err: unknown) {
  return isMissingColumnErr(err) || isInvalidEnumValueErr(err)
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { workerId?: unknown }
    const idCheck = parseRequiredUuid(
      typeof body.workerId === "string" ? body.workerId : "",
      "workerId",
    )
    if (!idCheck.ok) {
      return NextResponse.json({ error: idCheck.error }, { status: 400 })
    }
    const workerId = idCheck.value

    const auth = await requireStaffApiSession()
    if (auth instanceof NextResponse) return auth

    const url = getSupabaseUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)
    const { data: worker, error: workerErr } = await supabase
      .from("worker")
      .select("*")
      .eq("id", workerId)
      .maybeSingle()

    if (workerErr) throw workerErr
    if (!worker?.id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    }

    const row = worker as Record<string, unknown>
    const previousPipelineStatus =
      typeof row.worker_status === "string" && row.worker_status.trim()
        ? row.worker_status.trim()
        : typeof row.status === "string" && row.status.trim()
          ? row.status.trim()
          : null
    const previousWorkStatus =
      typeof row.status === "string" && row.status.trim() ? row.status.trim() : null

    const updatedAt = new Date().toISOString()
    const attempts: Array<{ column: "worker_status" | "status"; payload: Record<string, unknown> }> = [
      { column: "worker_status", payload: { worker_status: "approved", updated_at: updatedAt } },
      { column: "status", payload: { status: "approved", updated_at: updatedAt } },
    ]

    let updatedColumn: "worker_status" | "status" | null = null
    let lastErr: unknown = null
    for (const attempt of attempts) {
      const { error } = await supabase.from("worker").update(attempt.payload).eq("id", workerId)
      if (!error) {
        updatedColumn = attempt.column
        lastErr = null
        break
      }
      lastErr = error
      if (!canTryNextStatusColumn(error)) break
    }

    if (lastErr || !updatedColumn) {
      const err = lastErr as { message?: string; details?: string; hint?: string } | null
      const msg = [err?.message, err?.details, err?.hint].filter(Boolean).join(" — ")
      return NextResponse.json({ error: msg || "Could not approve worker" }, { status: 500 })
    }

    await writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      action: "worker.approved_for_work",
      entityType: "worker",
      entityId: workerId,
      tenantId:
        typeof row.tenant_id === "string" && row.tenant_id.trim() ? row.tenant_id.trim() : null,
      metadata: {
        source: "Admin UI",
        previous_status: previousPipelineStatus,
        next_status: "approved",
        status_column: updatedColumn,
        previous_work_status: previousWorkStatus,
      },
      request: req,
    })

    return NextResponse.json({
      ok: true,
      worker: {
        id: workerId,
        status: "approved",
        status_label: "Approved",
        work_status: previousWorkStatus,
      },
    })
  } catch (err: unknown) {
    console.error("[admin/worker-profile/approve]", err)
    const message = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
