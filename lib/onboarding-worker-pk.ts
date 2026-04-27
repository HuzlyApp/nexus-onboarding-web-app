import type { SupabaseClient } from "@supabase/supabase-js"

/** Returns `worker.id` when a worker row exists for the session applicant / auth user. */
export async function getWorkerPrimaryKey(supabase: SupabaseClient): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser()
  const authId = userData?.user?.id
  const applicantFromLs =
    typeof window !== "undefined" ? localStorage.getItem("applicantId")?.trim() || null : null
  const uid = authId ?? applicantFromLs
  if (!uid) return null

  const { data: worker, error } = await supabase
    .from("worker")
    .select("id")
    .eq("user_id", uid)
    .maybeSingle()

  if (error || !worker?.id) return null
  return String(worker.id)
}

/** Legacy `skill_assessments.worker_id`: worker PK or stable user id string. */
export async function getSkillAssessmentWorkerKey(supabase: SupabaseClient): Promise<string | null> {
  const pk = await getWorkerPrimaryKey(supabase)
  if (pk) return pk
  const { data: userData } = await supabase.auth.getUser()
  return userData?.user?.id ?? null
}
