import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { writeActivityLog } from "@/lib/audit/activity-log"
import {
  type AdminSupabaseClient,
  loadFacilities,
  loadWorkerFacilityAssignments,
} from "@/lib/admin/worker-facility-assignments"
import { requireApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/app-role"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

function asTrimmedString(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

async function loadWorkerRow(supabase: AdminSupabaseClient, workerId: string) {
  const { data, error } = await supabase.from("worker").select("*").eq("id", workerId).maybeSingle()
  if (error) return { worker: null, error }
  return { worker: (data as Record<string, unknown> | null) ?? null, error: null }
}

export async function GET(req: NextRequest) {
  const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || ""
  const idCheck = parseRequiredUuid(workerIdRaw, "workerId")
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 })
  }
  const workerId = idCheck.value

  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  const url = getSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
  }

  const supabase = createClient(url, key) as AdminSupabaseClient
  const { worker, error: workerError } = await loadWorkerRow(supabase, workerId)
  if (workerError) {
    return NextResponse.json({ error: workerError.message }, { status: 500 })
  }
  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 })
  }

  if (
    !canAccessWorkerRecord(auth, {
      id: String(worker.id ?? workerId),
      user_id: worker.user_id,
    })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const tenantId = asTrimmedString(worker.tenant_id)
  const { assignments, error: assignmentError } = await loadWorkerFacilityAssignments(supabase, {
    workerTableId: workerId,
    workerAuthId: asTrimmedString(worker.user_id),
  })
  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 500 })
  }

  const { facilities, error: facilityError } = await loadFacilities(supabase, tenantId)
  if (facilityError) {
    return NextResponse.json({ error: facilityError.message }, { status: 500 })
  }

  return NextResponse.json({
    assignments,
    facilities,
    worker_user_id: asTrimmedString(worker.user_id),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth
  if (!isStaffRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const workerIdCheck = parseRequiredUuid(String(body.workerId ?? ""), "workerId")
  if (!workerIdCheck.ok) {
    return NextResponse.json({ error: workerIdCheck.error }, { status: 400 })
  }
  const workerId = workerIdCheck.value

  const facilityId = asTrimmedString(body.facilityId)
  const shiftId = asTrimmedString(body.shiftId)
  if (!facilityId && !shiftId) {
    return NextResponse.json({ error: "Provide facilityId or shiftId" }, { status: 400 })
  }

  const url = getSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 })
  }

  const supabase = createClient(url, key) as AdminSupabaseClient
  const { worker, error: workerError } = await loadWorkerRow(supabase, workerId)
  if (workerError) {
    return NextResponse.json({ error: workerError.message }, { status: 500 })
  }
  if (!worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 })
  }

  const workerAuthId = asTrimmedString(worker.user_id)
  if (!workerAuthId) {
    return NextResponse.json(
      { error: "Worker has no linked auth account; cannot assign to shifts yet." },
      { status: 400 }
    )
  }

  let resolvedShiftId = shiftId
  if (!resolvedShiftId && facilityId) {
    const { data: shiftRows, error: shiftLookupError } = await supabase
      .from("shifts")
      .select("id")
      .eq("facility_id", facilityId)
      .order("posted_at", { ascending: false })
      .limit(1)

    if (shiftLookupError) {
      return NextResponse.json({ error: shiftLookupError.message }, { status: 500 })
    }
    resolvedShiftId = asTrimmedString((shiftRows?.[0] as { id?: unknown } | undefined)?.id)
    if (!resolvedShiftId) {
      return NextResponse.json(
        {
          error:
            "No open shift exists for this facility. Create a shift for the facility first, then assign the worker.",
        },
        { status: 400 }
      )
    }
  }

  const shiftIdCheck = parseRequiredUuid(resolvedShiftId ?? "", "shiftId")
  if (!shiftIdCheck.ok) {
    return NextResponse.json({ error: shiftIdCheck.error }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from("worker_shift_assignments")
    .select("id")
    .eq("worker_id", workerAuthId)
    .eq("shift_id", shiftIdCheck.value)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "Worker is already assigned to this shift" }, { status: 409 })
  }

  let tenantId = asTrimmedString(worker.tenant_id)
  if (!tenantId) {
    const { data: shiftRow } = await supabase
      .from("shifts")
      .select("tenant_id")
      .eq("id", shiftIdCheck.value)
      .maybeSingle()
    tenantId = asTrimmedString((shiftRow as { tenant_id?: unknown } | null)?.tenant_id)
  }
  if (!tenantId) {
    return NextResponse.json(
      { error: "Cannot assign worker: missing tenant on worker and shift records." },
      { status: 400 }
    )
  }

  const { data: inserted, error: insertError } = await supabase
    .from("worker_shift_assignments")
    .insert({
      tenant_id: tenantId,
      shift_id: shiftIdCheck.value,
      worker_id: workerAuthId,
      status: "confirmed",
      assigned_at: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  void writeActivityLog({
    actorUserId: auth.devBypass ? null : auth.userId,
    action: "worker.facility_assigned",
    entityType: "worker",
    entityId: workerId,
    tenantId,
    metadata: {
      shift_id: shiftIdCheck.value,
      facility_id: facilityId,
      assignment_id: inserted?.id ?? null,
    },
    request: req,
  })

  const { assignments } = await loadWorkerFacilityAssignments(supabase, {
    workerTableId: workerId,
    workerAuthId: workerAuthId,
  })

  return NextResponse.json({ ok: true, assignment: inserted, assignments })
}
