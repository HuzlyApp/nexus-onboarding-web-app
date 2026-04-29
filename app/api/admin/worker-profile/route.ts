import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { writeActivityLog } from "@/lib/audit/activity-log"
import { requireApiSession } from "@/lib/auth/api-session"
import { isStaffRole } from "@/lib/auth/app-role"
import { canAccessWorkerRecord } from "@/lib/auth/worker-record-access"
import { normalizeResumeStorageObjectPath } from "@/lib/onboarding/normalize-resume-storage-path"
import { getSupabaseUrl } from "@/lib/supabase-env"
import { WORKER_RESUMES_BUCKET } from "@/lib/supabase-storage-buckets"
import { parseRequiredUuid } from "@/lib/validation/uuid"

export const runtime = "nodejs"

function hasUrl(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 0
}

function urlOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null
  const s = v.trim()
  return s.length > 0 ? s : null
}

function titleCaseStatus(s: string | null | undefined): string {
  const v = (s || "").trim().toLowerCase()
  if (!v) return "New Applicant"
  if (v === "new") return "New Applicant"
  return v.charAt(0).toUpperCase() + v.slice(1)
}

type ZohoSignRow = {
  request_id: string | null
  zoho_document_id: string | null
  status: string | null
  updated_at: string | null
}

export async function GET(req: NextRequest) {
  try {
    const workerIdRaw = req.nextUrl.searchParams.get("workerId")?.trim() || ""
    if (!workerIdRaw) {
      return NextResponse.json({ error: "Missing workerId" }, { status: 400 })
    }
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

    const supabase = createClient(url, key)

    const { data: worker, error: wErr } = await supabase
      .from("worker")
      .select("*")
      .eq("id", workerId)
      .maybeSingle()

    if (wErr) throw wErr
    if (!worker?.id) {
      return NextResponse.json({ error: "Worker not found" }, { status: 404 })
    }

    const w = worker as Record<string, unknown>
    if (!canAccessWorkerRecord(auth, { id: String(w.id), user_id: w.user_id })) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const userIdForLegacy =
      w.user_id != null && String(w.user_id).trim() !== "" ? String(w.user_id) : null

    const { data: reqRows, error: reqErr } = await supabase
      .from("worker_requirements")
      .select("resume_path")
      .or(
        userIdForLegacy
          ? `worker_id.eq.${workerId},worker_id.eq.${userIdForLegacy}`
          : `worker_id.eq.${workerId}`
      )
      .limit(1)

    if (reqErr) {
      console.warn("[admin/worker-profile] worker_requirements", reqErr)
    }

    const reqRow = Array.isArray(reqRows) ? reqRows[0] : reqRows
    const resumePathRaw = (reqRow as { resume_path?: string } | null | undefined)?.resume_path
    const resumePathStored =
      typeof resumePathRaw === "string" && resumePathRaw.trim() !== ""
        ? resumePathRaw.trim()
        : null

    const resumePath = resumePathStored ? normalizeResumeStorageObjectPath(resumePathStored) : null
    const resumePathCanonical =
      resumePath && resumePath.length > 0 ? resumePath : null

    let resumeUrl: string | null = null
    if (resumePathCanonical) {
      const { data: signed, error: signErr } = await supabase.storage
        .from(WORKER_RESUMES_BUCKET)
        .createSignedUrl(resumePathCanonical, 3600)
      if (signErr) {
        console.warn("[admin/worker-profile] resume signed URL", signErr)
      } else {
        resumeUrl = signed?.signedUrl ?? null
      }
    }

    const { data: docRow } = await supabase
      .from("worker_documents")
      .select("*")
      .eq("worker_id", workerId)
      .maybeSingle()

    const docs = (docRow ?? null) as Record<string, unknown> | null
    const workerEmail = w.email != null ? String(w.email).trim().toLowerCase() : ""
    const licenseOk = hasUrl(docs?.nursing_license_url)
    const tbOk = hasUrl(docs?.tb_test_url)
    const cprOk = hasUrl(docs?.cpr_certification_url)
    const idOk = hasUrl(docs?.ssn_url) || hasUrl(docs?.drivers_license_url)
    const docsCompleteCount = [licenseOk, tbOk, cprOk, idOk].filter(Boolean).length

    const { data: refRows } = await supabase
      .from("worker_references")
      .select("id, reference_first_name, reference_last_name, reference_phone, reference_email, created_at")
      .eq("worker_id", workerId)
      .order("created_at", { ascending: true })
      .limit(10)

    const references = (refRows ?? []).map((r) => {
      const row = r as Record<string, unknown>
      const fn = String(row.reference_first_name ?? "").trim()
      const ln = String(row.reference_last_name ?? "").trim()
      const name = `${fn} ${ln}`.trim() || "—"
      return {
        id: String(row.id),
        name,
        phone: row.reference_phone != null ? String(row.reference_phone) : null,
        email: row.reference_email != null ? String(row.reference_email) : null,
      }
    })

    let saCompleted = 0
    let saTotal = 0
    const { data: saRows, error: saErr } = await supabase
      .from("skill_assessments")
      .select("category, completed")
      .eq("worker_id", workerId)

    if (!saErr && Array.isArray(saRows) && saRows.length > 0) {
      saTotal = saRows.length
      saCompleted = saRows.filter((x) => (x as { completed?: boolean }).completed === true).length
    } else {
      saTotal = 6
    }

    const profileComplete = Boolean(w.id)
    const hasResumePath = Boolean(resumePathCanonical)
    const licenseStep = licenseOk
    const assessmentsComplete = saTotal > 0 && saCompleted >= saTotal
    const authDocsComplete = docsCompleteCount >= 4
    const referencesComplete = references.length >= 2
    const hasDocumentsRow = docRow != null

    type StepState = "complete" | "in_progress" | "pending"
    const step = (done: boolean, partial: boolean): StepState => {
      if (done) return "complete"
      if (partial) return "in_progress"
      return "pending"
    }

    const onboardingSteps = [
      {
        id: "resume",
        label: "Add Resume / Profile",
        state: step(hasResumePath, !hasResumePath && profileComplete),
      },
      {
        id: "license",
        label: "Professional License",
        state: step(licenseStep, !licenseStep && hasDocumentsRow),
      },
      {
        id: "skills",
        label: "Skill Assessment",
        state: step(assessmentsComplete, saCompleted > 0 && !assessmentsComplete),
        detail: saTotal ? `${saCompleted} of ${saTotal}` : undefined,
      },
      {
        id: "auth_docs",
        label: "Authorizations & Documents",
        state: step(authDocsComplete, docsCompleteCount > 0 && !authDocsComplete),
        detail: `${docsCompleteCount} of 4`,
      },
      {
        id: "references",
        label: "Add References",
        state: step(referencesComplete, references.length > 0 && !referencesComplete),
        detail: `${references.length} added`,
      },
    ]

    const createdAt = w.created_at != null ? String(w.created_at) : null
    const updatedAt = w.updated_at != null ? String(w.updated_at) : createdAt

    const statusRaw = (w.status ?? w.worker_status) as string | undefined
    const statusLabel = titleCaseStatus(statusRaw)

    let zohoSign: ZohoSignRow | null = null
    if (workerEmail) {
      const { data: zohoRow, error: zohoErr } = await supabase
        .from("zoho_sign_requests")
        .select("request_id,zoho_document_id,status,updated_at")
        .eq("email", workerEmail)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      if (zohoErr) {
        console.warn("[admin/worker-profile] zoho_sign_requests", zohoErr)
      } else {
        zohoSign = (zohoRow as ZohoSignRow | null) ?? null
      }
    }

    void writeActivityLog({
      actorUserId: auth.devBypass ? null : auth.userId,
      action: isStaffRole(auth.role) ? "worker.profile.view" : "worker.profile.self_view",
      entityType: "worker",
      entityId: workerId,
      metadata: { route: "GET /api/admin/worker-profile", staff: isStaffRole(auth.role) },
      request: req,
    })

    return NextResponse.json({
      worker: {
        id: String(w.id),
        first_name: w.first_name != null ? String(w.first_name) : null,
        last_name: w.last_name != null ? String(w.last_name) : null,
        email: w.email != null ? String(w.email) : null,
        phone: w.phone != null ? String(w.phone) : null,
        address1: w.address1 != null ? String(w.address1) : null,
        address2: w.address2 != null ? String(w.address2) : null,
        city: w.city != null ? String(w.city) : null,
        state: w.state != null ? String(w.state) : null,
        zip: w.zip != null ? String(w.zip) : null,
        job_role: w.job_role != null ? String(w.job_role) : null,
        created_at: createdAt,
        updated_at: updatedAt,
        status: statusRaw ?? "new",
        status_label: statusLabel,
        date_of_birth: w.date_of_birth != null ? String(w.date_of_birth) : null,
        years_experience:
          typeof w.years_experience === "number"
            ? w.years_experience
            : w.years_experience != null && String(w.years_experience).trim() !== ""
              ? Number(w.years_experience)
              : null,
        hourly_rate: w.hourly_rate != null ? String(w.hourly_rate) : null,
        ssn_last_four: w.ssn_last_four != null ? String(w.ssn_last_four) : null,
      },
      requirements: {
        resume_path: resumePathCanonical,
        resume_path_raw: resumePathStored,
        resume_url: resumeUrl,
      },
      documents: docs
        ? {
            updated_at: docs.updated_at != null ? String(docs.updated_at) : null,
            nursing_license_url: licenseOk,
            tb_test_url: tbOk,
            cpr_certification_url: cprOk,
            identity_uploaded: idOk,
          }
        : null,
      document_urls: {
        nursing_license_url: urlOrNull(docs?.nursing_license_url),
        tb_test_url: urlOrNull(docs?.tb_test_url),
        cpr_certification_url: urlOrNull(docs?.cpr_certification_url),
        ssn_url: urlOrNull(docs?.ssn_url),
        ssn_back_url: urlOrNull(docs?.ssn_back_url),
        drivers_license_url: urlOrNull(docs?.drivers_license_url),
        drivers_license_back_url: urlOrNull(docs?.drivers_license_back_url),
      },
      signeasy: {
        document_name:
          docs != null && docs.document_name != null ? String(docs.document_name) : null,
        document_id:
          docs != null && docs.document_id != null ? String(docs.document_id) : null,
      },
      zoho_sign: {
        request_id: zohoSign?.request_id ?? null,
        document_id: zohoSign?.zoho_document_id ?? null,
        status: zohoSign?.status ?? null,
        updated_at: zohoSign?.updated_at ?? null,
      },
      references,
      skillAssessments: { completed: saCompleted, total: saTotal },
      onboardingSteps,
      activity: {
        source: "Onboarding application",
        created_at: createdAt,
        updated_at: updatedAt,
      },
    })
  } catch (err: unknown) {
    console.error("[admin/worker-profile]", err)
    const msg = err instanceof Error ? err.message : "Unexpected error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
