import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

/** Matches service-role clients from `createClient(url, key)` in API routes. */
export type AdminSupabaseClient = SupabaseClient<any, "public", "public">

export type WorkerFacilityAssignment = {
  assignment_id: string | null
  assigned_at: string | null
  status: string | null
  shift_id: string | null
  shift_title: string | null
  facility_id: string | null
  facility_name: string | null
  facility_address: string | null
}

function asTrimmedString(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000"

/** Resolve facility rows via worker_shift_assignments → shifts → facility. */
export async function loadWorkerFacilityAssignments(
  supabase: AdminSupabaseClient,
  params: { workerTableId: string; workerAuthId: string | null }
): Promise<{ assignments: WorkerFacilityAssignment[]; error: PostgrestError | null }> {
  const workerKeys = Array.from(
    new Set(
      [params.workerTableId, params.workerAuthId].filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    )
  )

  if (workerKeys.length === 0) {
    return { assignments: [], error: null }
  }

  const assignmentQuery =
    workerKeys.length === 1
      ? supabase.from("worker_shift_assignments").select("*").eq("worker_id", workerKeys[0])
      : supabase.from("worker_shift_assignments").select("*").in("worker_id", workerKeys)

  const { data: assignmentRows, error: assignmentError } = await assignmentQuery
  if (assignmentError) {
    return { assignments: [], error: assignmentError }
  }

  const assignments = (assignmentRows ?? []) as Record<string, unknown>[]
  if (assignments.length === 0) {
    return { assignments: [], error: null }
  }

  const shiftIds = assignments
    .map((row) => String(row.shift_id ?? "").trim())
    .filter((id) => id.length > 0)

  const { data: shiftRows, error: shiftError } = await supabase
    .from("shifts")
    .select("*")
    .in("id", shiftIds.length > 0 ? shiftIds : [EMPTY_UUID])

  if (shiftError) {
    return { assignments: [], error: shiftError }
  }

  const shiftById = new Map<string, Record<string, unknown>>(
    ((shiftRows ?? []) as Record<string, unknown>[]).map((row) => [String(row.id ?? ""), row])
  )

  const facilityIds = ((shiftRows ?? []) as Record<string, unknown>[])
    .map((row) => String(row.facility_id ?? "").trim())
    .filter((id) => id.length > 0)

  const { data: facilityRows, error: facilityError } = await supabase
    .from("facility")
    .select("*")
    .in("id", facilityIds.length > 0 ? facilityIds : [EMPTY_UUID])

  if (facilityError) {
    return { assignments: [], error: facilityError }
  }

  const facilityById = new Map<string, Record<string, unknown>>(
    ((facilityRows ?? []) as Record<string, unknown>[]).map((row) => [String(row.id ?? ""), row])
  )

  const seenAssignmentIds = new Set<string>()
  const result: WorkerFacilityAssignment[] = []

  for (const assignment of assignments) {
    const assignmentId = String(assignment.id ?? "")
    if (assignmentId && seenAssignmentIds.has(assignmentId)) continue
    if (assignmentId) seenAssignmentIds.add(assignmentId)

    const shift = shiftById.get(String(assignment.shift_id ?? ""))
    const facility = shift ? facilityById.get(String(shift.facility_id ?? "")) : null

    result.push({
      assignment_id: assignment.id != null ? String(assignment.id) : null,
      assigned_at: asTrimmedString(assignment.assigned_at),
      status: asTrimmedString(assignment.status),
      shift_id: assignment.shift_id != null ? String(assignment.shift_id) : null,
      shift_title: asTrimmedString(shift?.title),
      facility_id: shift?.facility_id != null ? String(shift.facility_id) : null,
      facility_name: asTrimmedString(facility?.name),
      facility_address: asTrimmedString(facility?.address),
    })
  }

  return { assignments: result, error: null }
}

export type FacilityListItem = {
  id: string
  name: string
  address: string | null
  phone: string | null
}

export async function loadFacilities(
  supabase: AdminSupabaseClient,
  tenantId?: string | null
): Promise<{ facilities: FacilityListItem[]; error: PostgrestError | null }> {
  let query = supabase.from("facility").select("id,name,address,phone").order("name", { ascending: true })
  if (tenantId) {
    query = query.eq("tenant_id", tenantId)
  }
  const { data, error } = await query
  if (error) {
    return { facilities: [], error }
  }
  const facilities = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id ?? ""),
    name: asTrimmedString(row.name) ?? "Unnamed facility",
    address: asTrimmedString(row.address),
    phone: asTrimmedString(row.phone),
  }))
  return { facilities, error: null }
}
