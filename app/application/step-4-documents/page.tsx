"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { FileText, Trash2 } from "lucide-react"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import {
  fetchZohoSignStatus,
  mapZohoStatusToLabel,
  sendAgreement,
  subscribeToZohoSignStatus,
  type ZohoSignDbStatus,
} from "@/lib/zoho-sign-status"

type IdentityPaths = {
  ssnFront: string | null
  ssnBack: string | null
  dlFront: string | null
  dlBack: string | null
}

function fileLabel(path: string) {
  const seg = path.split("/").pop() || path
  return seg.length > 40 ? `${seg.slice(0, 18)}…${seg.slice(-12)}` : seg
}

function isPdfPath(path: string) {
  return /\.pdf$/i.test(path)
}

function signingStatusBadgeClass(status: string) {
  const s = status.trim().toLowerCase()
  if (s === "completed") return "bg-emerald-100 text-emerald-700"
  if (s === "signed") return "bg-teal-100 text-teal-700"
  if (s === "viewed") return "bg-sky-100 text-sky-700"
  if (s === "declined") return "bg-rose-100 text-rose-700"
  return "bg-amber-100 text-amber-700"
}

export default function DocumentsPage() {
  const router = useRouter()

  const [mounted, setMounted] = useState(false)

  const [applicantId, setApplicantId] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("step4AuthorizationAgreed") === "true"
  })
  const [identityPaths, setIdentityPaths] = useState<IdentityPaths>({
    ssnFront: null,
    ssnBack: null,
    dlFront: null,
    dlBack: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [zohoNote, setZohoNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [signerEmail, setSignerEmail] = useState("")
  const [signerName, setSignerName] = useState("")

  const [signingUrl, setSigningUrl] = useState<string | null>(null)
  const [showSigningModal, setShowSigningModal] = useState(false)
  const [signingLoading, setSigningLoading] = useState(false)
  const [refreshingSigningSession, setRefreshingSigningSession] = useState(false)
  const [envelopeId, setEnvelopeId] = useState<string | null>(null)
  const [signingActionId, setSigningActionId] = useState<string | null>(null)
  const [isSigned, setIsSigned] = useState(false)
  const [signingStatus, setSigningStatus] = useState<ZohoSignDbStatus>("sent")
  /** Existing active Zoho request can be resumed with a fresh embed token. */
  const [onboardingAgreementLocked, setOnboardingAgreementLocked] = useState(false)

  const signedFromStatus = signingStatus === "signed" || signingStatus === "completed"
  const effectiveSigned = isSigned || signedFromStatus
  const canRefreshExistingSignUrl = onboardingAgreementLocked && Boolean(envelopeId && signingActionId) && !effectiveSigned
  const signingActionDisabled = signingLoading || !agreed

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (signedFromStatus) setAgreed(true)
  }, [signedFromStatus])

  useEffect(() => {
    if (effectiveSigned) {
      setShowSigningModal(false)
    }
  }, [effectiveSigned])

  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem("step4AuthorizationAgreed", agreed ? "true" : "false")
  }, [agreed])

  const identityDocsComplete = useMemo(() => {
    const { ssnFront, dlFront } = identityPaths
    return Boolean(ssnFront && dlFront)
  }, [identityPaths])

  useEffect(() => {
    const id = localStorage.getItem("applicantId")
    if (id) {
      setApplicantId(id)
    } else {
      router.push("/application/step-1-review")
    }
  }, [router])

  useEffect(() => {
    const saved = localStorage.getItem("parsedResume")
    if (!saved) return
    try {
      const p = JSON.parse(saved) as Record<string, string>
      const em = (p.email || "").trim()
      const fn = (p.firstName || p.first_name || "").trim()
      const ln = (p.lastName || p.last_name || "").trim()
      if (em) setSignerEmail(em.toLowerCase())
      if (fn || ln) setSignerName(`${fn} ${ln}`.trim())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const existingRequestId = localStorage.getItem("signingRequestId")?.trim()
    const existingActionId = localStorage.getItem("signingActionId")?.trim()
    if (existingRequestId) {
      setEnvelopeId(existingRequestId)
    }
    if (existingActionId) {
      setSigningActionId(existingActionId)
    }
    const cachedStatus = (localStorage.getItem("signingStatus") || "").trim().toLowerCase()
    if (
      cachedStatus === "sent" ||
      cachedStatus === "viewed" ||
      cachedStatus === "signed" ||
      cachedStatus === "completed" ||
      cachedStatus === "declined"
    ) {
      setSigningStatus(cachedStatus as ZohoSignDbStatus)
    }
  }, [])

  useEffect(() => {
    if (envelopeId) localStorage.setItem("signingRequestId", envelopeId)
    if (signingActionId) localStorage.setItem("signingActionId", signingActionId)
    localStorage.setItem("signingStatus", signingStatus)
  }, [envelopeId, signingActionId, signingStatus])

  useEffect(() => {
    if (!applicantId) return
    void supabase
      .from("worker")
      .select("email, first_name, last_name")
      .eq("user_id", applicantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.email?.trim()) setSignerEmail(data.email.trim().toLowerCase())
        const fn = (data?.first_name || "").trim()
        const ln = (data?.last_name || "").trim()
        if (fn || ln) setSignerName(`${fn} ${ln}`.trim())
      })
  }, [applicantId])

  const refreshIdentityDocsStatus = useCallback(async () => {
    if (!applicantId) return
    const res = await fetch(
      `/api/onboarding/worker-documents?applicantId=${encodeURIComponent(applicantId)}`
    )
    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      documents?: {
        ssn_url?: string | null
        ssn_back_url?: string | null
        drivers_license_url?: string | null
        drivers_license_back_url?: string | null
      } | null
    }
    if (!res.ok) {
      console.error("[step-4-documents] worker-documents api", json)
      return
    }
    const docs = json.documents ?? null

    const t = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

    setIdentityPaths({
      ssnFront: t(docs?.ssn_url),
      ssnBack: t(docs?.ssn_back_url),
      dlFront: t(docs?.drivers_license_url),
      dlBack: t(docs?.drivers_license_back_url),
    })
  }, [applicantId])

  useEffect(() => {
    void refreshIdentityDocsStatus()
  }, [refreshIdentityDocsStatus])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void refreshIdentityDocsStatus()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [refreshIdentityDocsStatus])

  const publicUrl = useCallback((path: string) => {
    return supabase.storage.from(WORKER_REQUIRED_FILES_BUCKET).getPublicUrl(path).data.publicUrl
  }, [])

  const startSigning = useCallback(async () => {
    if (!agreed) {
      setError("Please agree to the authorization first.")
      return
    }
    if (!signerEmail || !signerName) {
      setError("Missing your name or email. Complete Step 1 (review your profile) first.")
      return
    }
    if (!applicantId) return

    setSigningLoading(true)
    setError(null)

    try {
      const openEmbeddedFallback = async (opts?: { requestId?: string; actionId?: string }) => {
        const response = await fetch("/api/zoho-sign/create-embedded-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicantId,
            email: signerEmail.trim().toLowerCase(),
            name: signerName,
            requestId: opts?.requestId,
            actionId: opts?.actionId,
            origin: window.location.origin,
          }),
        })
        const json = (await response.json().catch(() => ({}))) as {
          error?: string
          signingUrl?: string
          requestId?: string
          actionId?: string
        }
        if (!response.ok || !json.signingUrl) {
          throw new Error(json.error || "Unable to open embedded signing session right now. Please try again.")
        }
        setSigningUrl(json.signingUrl)
        setShowSigningModal(true)
        if (json.requestId) {
          setEnvelopeId(json.requestId)
          localStorage.setItem("signingRequestId", json.requestId)
        }
        if (json.actionId) {
          setSigningActionId(json.actionId)
          localStorage.setItem("signingActionId", json.actionId)
        }
        setOnboardingAgreementLocked(true)
      }

      const data = await sendAgreement({
        name: signerName,
        email: signerEmail.trim().toLowerCase(),
        user_id: applicantId,
        project_id: "onboarding",
        onboarding_id: applicantId,
        host: /^https:\/\//i.test(window.location.origin) ? window.location.origin : undefined,
        request_id: onboardingAgreementLocked && envelopeId ? envelopeId : undefined,
        action_id: onboardingAgreementLocked && signingActionId ? signingActionId : undefined,
      })
      const nextSigningUrl = data.sign_url || data.signing_url || null
      if (!nextSigningUrl) {
        await openEmbeddedFallback({ requestId: data.request_id, actionId: data.action_id })
        return
      }
      setSigningUrl(nextSigningUrl)
      setShowSigningModal(true)
      setEnvelopeId(data.request_id)
      setSigningActionId(data.action_id || null)
      setSigningStatus(data.status || "sent")
      localStorage.setItem("signingRequestId", data.request_id)
      if (data.action_id) localStorage.setItem("signingActionId", data.action_id)
      setOnboardingAgreementLocked(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signing setup failed"
      try {
        const fallbackRow = await fetchZohoSignStatus({ email: signerEmail.trim().toLowerCase() })
        if (fallbackRow?.request_id) {
          const response = await fetch("/api/zoho-sign/create-embedded-sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              applicantId,
              email: signerEmail.trim().toLowerCase(),
              name: signerName,
              requestId: fallbackRow.request_id,
              actionId: fallbackRow.action_id || undefined,
              origin: window.location.origin,
            }),
          })
          const json = (await response.json().catch(() => ({}))) as {
            signingUrl?: string
            requestId?: string
            actionId?: string
          }
          if (response.ok && json.signingUrl) {
            setSigningUrl(json.signingUrl)
            setShowSigningModal(true)
            if (json.requestId) {
              setEnvelopeId(json.requestId)
              localStorage.setItem("signingRequestId", json.requestId)
            }
            if (json.actionId) {
              setSigningActionId(json.actionId)
              localStorage.setItem("signingActionId", json.actionId)
            }
            setOnboardingAgreementLocked(true)
            return
          }
        }
      } catch {
        // ignore fallback errors and show the original message
      }
      setError(message)
    } finally {
      setSigningLoading(false)
    }
  }, [agreed, applicantId, onboardingAgreementLocked, envelopeId, signerEmail, signerName, signingActionId])

  const refreshEmbeddedSigningSession = useCallback(async () => {
    if (!applicantId || !signerEmail || !signerName || !envelopeId || !signingActionId || effectiveSigned) return
    setRefreshingSigningSession(true)
    try {
      const data = await sendAgreement({
        name: signerName,
        email: signerEmail.trim().toLowerCase(),
        user_id: applicantId,
        project_id: "onboarding",
        onboarding_id: applicantId,
        host: /^https:\/\//i.test(window.location.origin) ? window.location.origin : undefined,
        request_id: envelopeId,
        action_id: signingActionId,
      })
      const refreshedUrl = data.sign_url || data.signing_url || null
      if (refreshedUrl) {
        setSigningUrl(refreshedUrl)
        setShowSigningModal(true)
      }
      if (data.action_id) {
        setSigningActionId(data.action_id)
        localStorage.setItem("signingActionId", data.action_id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not refresh signing session"
      setError(message)
    } finally {
      setRefreshingSigningSession(false)
    }
  }, [applicantId, envelopeId, effectiveSigned, signerEmail, signerName, signingActionId])

  const refreshSigningStatus = useCallback(async () => {
    const email = signerEmail.trim().toLowerCase()
    try {
      if (email) {
        const rowByEmail = await fetchZohoSignStatus({ email, reconcile: true })
        if (rowByEmail?.request_id) {
          setEnvelopeId(rowByEmail.request_id)
          if (rowByEmail.action_id) setSigningActionId(rowByEmail.action_id)
          setSigningStatus(rowByEmail.status || "sent")
          localStorage.setItem("signingRequestId", rowByEmail.request_id)
          if (rowByEmail.action_id) localStorage.setItem("signingActionId", rowByEmail.action_id)
          setOnboardingAgreementLocked(rowByEmail.status !== "declined")
          if (rowByEmail.status === "signed" || rowByEmail.status === "completed") {
            setAgreed(true)
          }
          return
        }
        setOnboardingAgreementLocked(false)
      }
      if (envelopeId) {
        const rowById = await fetchZohoSignStatus({ requestId: envelopeId, reconcile: true })
        if (rowById?.request_id) {
          setEnvelopeId(rowById.request_id)
          if (rowById.action_id) setSigningActionId(rowById.action_id)
          if (rowById.status) setSigningStatus(rowById.status)
          localStorage.setItem("signingRequestId", rowById.request_id)
          if (rowById.action_id) localStorage.setItem("signingActionId", rowById.action_id)
          setOnboardingAgreementLocked(rowById.status !== "declined")
          if (rowById.status === "signed" || rowById.status === "completed") {
            setAgreed(true)
          }
          return
        }
        // Stored request_id is stale/missing in DB; clear and let email lookup recover.
        localStorage.removeItem("signingRequestId")
        localStorage.removeItem("signingActionId")
        setEnvelopeId(null)
        setSigningActionId(null)
        setOnboardingAgreementLocked(false)
      }
    } catch {
      // ignore
    }
  }, [signerEmail, envelopeId])

  useEffect(() => {
    if (!envelopeId) return

    let cancelled = false
    void (async () => {
      try {
        const row = await fetchZohoSignStatus({ requestId: envelopeId, reconcile: true })
        if (!cancelled && row?.status) {
          setSigningStatus(row.status)
          setOnboardingAgreementLocked(row.status !== "declined")
          if (row.status === "signed" || row.status === "completed") setAgreed(true)
        }
      } catch {
        // ignore
      }
    })()

    const unsubscribe = subscribeToZohoSignStatus({
      requestId: envelopeId,
      onStatusChange: (next) => {
        setSigningStatus(next.status)
        if (next.status === "signed" || next.status === "completed") {
          setAgreed(true)
          setOnboardingAgreementLocked(true)
        }
        if (next.status === "declined") setOnboardingAgreementLocked(false)
      },
    })

    const pollingInterval = window.setInterval(() => {
      void refreshSigningStatus()
    }, 5000)

    return () => {
      cancelled = true
      unsubscribe()
      window.clearInterval(pollingInterval)
    }
  }, [envelopeId, refreshSigningStatus])

  // After refresh, localStorage request_id can be stale. Latest row for this email is source of truth.
  useEffect(() => {
    const email = signerEmail.trim()
    if (!email) return

    let cancelled = false
    void (async () => {
      try {
        const row = await fetchZohoSignStatus({ email: email.toLowerCase(), reconcile: true })
        if (cancelled) return
        if (!row?.request_id) {
          setOnboardingAgreementLocked(false)
          return
        }
        setEnvelopeId(row.request_id)
        if (row.action_id) setSigningActionId(row.action_id)
        setSigningStatus(row.status || "sent")
        localStorage.setItem("signingRequestId", row.request_id)
        if (row.action_id) localStorage.setItem("signingActionId", row.action_id)
        setOnboardingAgreementLocked(row.status !== "declined")
        if (row.status === "signed" || row.status === "completed") setAgreed(true)
      } catch {
        if (!cancelled) setOnboardingAgreementLocked(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [signerEmail])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshSigningStatus()
    }
    const onPageShow = () => {
      void refreshSigningStatus()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [refreshSigningStatus])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const d = event.data
      if (
        (d?.source === "zoho-sign" || d?.source === "signing") &&
        d?.event === "signing_complete"
      ) {
        setIsSigned(true)
        setSigningUrl(null)
        setShowSigningModal(false)
      }
    }

    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  useEffect(() => {
    if (!showSigningModal || !signingUrl || effectiveSigned) return
    const intervalId = window.setInterval(() => {
      void refreshEmbeddedSigningSession()
    }, 105000)
    return () => window.clearInterval(intervalId)
  }, [effectiveSigned, refreshEmbeddedSigningSession, showSigningModal, signingUrl])

  const syncZoho = async () => {
    if (!applicantId) return
    setZohoNote(null)
    try {
      const res = await fetch("/api/zoho/sync-onboarding-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 503 || String(data.error || "").includes("not configured")) {
          setZohoNote("Zoho sync skipped (not configured on server).")
          return
        }
        setZohoNote(data.error || "Zoho sync did not complete.")
        return
      }
      if (typeof data.synced === "number" && data.synced > 0) {
        setZohoNote(`Synced ${data.synced} file(s) to Zoho Recruit.`)
      }
    } catch {
      setZohoNote("Zoho sync failed.")
    }
  }

  const handleSaveAndContinue = async () => {
    if (!agreed) {
      setError("You must agree to the authorization.")
      return
    }

    if (!effectiveSigned) {
      setError("Please sign the authorization document first.")
      return
    }

    if (!identityDocsComplete) {
      setError("Upload SSN and driver’s license (front) on the identity step.")
      return
    }

    if (!applicantId) {
      setError("Missing applicant session. Return to Step 1.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const ssn_url = identityPaths.ssnFront ? publicUrl(identityPaths.ssnFront) : null
      const drivers_license_url = identityPaths.dlFront ? publicUrl(identityPaths.dlFront) : null
      const ssn_back_url = null
      const drivers_license_back_url = null

      const docRes = await fetch("/api/onboarding/worker-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId,
          ssn_url,
          ssn_back_url,
          drivers_license_url,
          drivers_license_back_url,
        }),
      })
      const docJson = (await docRes.json()) as { error?: string }
      if (!docRes.ok) {
        throw new Error(docJson.error || "Could not save worker documents")
      }

      await syncZoho()
      router.push("/application/step-5-add-references")
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed"
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleSkipForNow = () => {
    localStorage.setItem("step4Skipped", "1")
    router.push("/application/step-5-add-references")
  }

  function IdentityFileCard({
    path,
    subtitle,
  }: {
    path: string | null
    subtitle: string
  }) {
    if (!path) {
      return (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80 p-6 text-center text-sm text-gray-500">
          Not uploaded
        </div>
      )
    }
    const url = publicUrl(path)
    const pdf = isPdfPath(path)

    return (
      <div className="rounded-xl border border-teal-200 bg-white p-3 shadow-sm flex gap-3 items-center">
        <div className="w-16 h-16 shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center">
          {pdf ? (
            <FileText className="w-8 h-8 text-teal-600" />
          ) : (
            <Image src={url} alt="" width={64} height={64} className="object-cover w-full h-full" unoptimized />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">{subtitle}</p>
          <p className="text-sm font-medium text-gray-900 truncate" title={fileLabel(path)}>
            {fileLabel(path)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/application/step-4-identity")}
          className="p-2 text-gray-400 hover:text-red-600 rounded-lg"
          aria-label="Replace file"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    )
  }

  if (!mounted) return null

  return (
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageSrc="/images/n1.jpg"
      rightPanelImageClassName="opacity-60 object-top"
      rightPanelOverlayClassName="bg-white/65"
    >
      {showSigningModal && signingUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Embedded signing session"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowSigningModal(false)
          }}
        >
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {refreshingSigningSession ? "Refreshing signing session..." : "Review & Sign Agreement"}
              </p>
              <button
                type="button"
                onClick={() => setShowSigningModal(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
            <div className="h-[80vh] bg-white">
              <iframe
                title="Embedded Zoho Sign session"
                src={signingUrl}
                className="w-full h-full"
                allow="fullscreen"
              />
            </div>
          </div>
        </div>
      )}
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper currentStep={4} completedThrough={3} />

        <div className="flex flex-1 flex-col pt-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h1 className="text-3xl font-semibold text-slate-900 leading-[1.1]">
              Authorizations &amp; Documents
            </h1>
            <button
              type="button"
              onClick={handleSkipForNow}
              className="text-[12px] font-medium leading-5 text-[#0D9488]"
            >
              Skip for Now →
            </button>
          </div>

          <div className="text-[13px] leading-6 text-slate-600 space-y-3 mb-8">
            <p>
              By selecting <span className="font-semibold text-slate-900">“I Agree,”</span> I authorize the Company to conduct a background check and, if required, a drug screening as part of my application or continued engagement.
            </p>
            <p>
              I understand this may include verification of my identity, employment history, education, and criminal records as permitted by law.
            </p>
            <p>
              I consent to the lawful collection, use, and disclosure of this information and release the Company from liability related to these authorized checks.
            </p>
          </div>

          <label
            className={`mb-8 inline-flex items-center gap-3 ${
              signedFromStatus ? "cursor-default" : "cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              checked={agreed}
              disabled={signedFromStatus}
              onChange={(e) => setAgreed(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                agreed ? "border-[#1db4a3] bg-[#1db4a3] text-white" : "border-slate-300 bg-white"
              } ${signedFromStatus ? "opacity-80" : ""}`}
              aria-hidden
            >
              {agreed ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <span className="text-slate-800 font-medium">I Agree to the Authorization</span>
          </label>

          {onboardingAgreementLocked && !effectiveSigned && (
            <p className="mb-4 text-sm text-slate-600 -mt-4">
              {envelopeId
                ? "A signing session already exists for this agreement. Click “Click and Sign” to reopen your secure signing session."
                : "Your agreement is ready for signature. Click “Click and Sign” to continue signing securely inside the onboarding portal."}
            </p>
          )}

          <div className="mb-8 space-y-6">
            <div>
              <p className="mb-3 text-[16px] font-semibold leading-6 text-black">Authorization Agreement</p>
              <div className="flex min-h-[72px] items-center justify-between gap-4 rounded-lg border border-[#0D9488] bg-white px-4 py-[14px]">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-6 w-6 shrink-0 text-[#0D9488]" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-normal leading-5 text-[#0D9488]">Authorization_agreement.pdf</p>
                    <p className="text-[10px] font-normal leading-[15px] text-slate-500">Mandatory</p>
                  </div>
                </div>

                {!signingUrl && !effectiveSigned && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!signerEmail || !signerName || !applicantId) {
                        setError("Missing your name or email. Complete Step 1 (review your profile) first.")
                        return
                      }
                      void startSigning()
                    }}
                    disabled={signingActionDisabled}
                    className={`rounded-lg border px-4 py-3 text-[14px] font-semibold leading-5 transition ${
                      signingActionDisabled
                        ? "cursor-not-allowed border-slate-300 text-slate-400"
                        : "border-[#0D9488] text-[#0D9488] hover:bg-[#f0fffe]"
                    }`}
                  >
                    {signingLoading ? "Preparing signing session..." : canRefreshExistingSignUrl ? "Continue Signing" : "Click and Sign"}
                  </button>
                )}

                {signingUrl && !effectiveSigned && (
                  <button
                    type="button"
                    onClick={() => setShowSigningModal(true)}
                    className="rounded-lg border border-[#0D9488] px-4 py-3 text-[14px] font-semibold leading-5 text-[#0D9488] transition hover:bg-[#f0fffe]"
                  >
                    Open signing
                  </button>
                )}

                {effectiveSigned && (
                  <span className="rounded-lg bg-[#0D9488] px-4 py-2 text-[12px] font-semibold leading-4 text-white">Signed</span>
                )}
              </div>
            </div>

            {envelopeId && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-600">
                <p className="truncate">Request ID: {envelopeId}</p>
                <div className="flex items-center gap-2">
                  <span>Status:</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${signingStatusBadgeClass(signingStatus)}`}>
                    {mapZohoStatusToLabel(signingStatus)}
                  </span>
                </div>
              </div>
            )}

            <div>
              <p className="mb-3 text-[16px] font-semibold leading-6 text-black">SSN &amp; Driver&apos;s License</p>
              <button
                type="button"
                onClick={() => router.push("/application/step-4-identity")}
                className="flex min-h-[63px] w-full items-center justify-between rounded-lg border border-[#0D9488] bg-white px-4 py-[14px] text-left transition hover:bg-[#f8fdfd]"
              >
                <div>
                  <p className="text-[14px] font-normal leading-5 text-[#0D9488]">SSN &amp; Driver&apos;s License</p>
                  <p className="text-[10px] font-normal leading-[15px] text-slate-500">Required</p>
                </div>
                <span className="text-lg font-semibold leading-none text-[#0D9488]">›</span>
              </button>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <p className="text-[15px] font-semibold text-slate-900">Add Documents</p>
              <button
                type="button"
                onClick={() => router.push("/application/step-4-identity")}
                className="text-[12px] font-medium text-[#0D9488]"
              >
                Edit uploads
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-[13px] font-semibold text-slate-900 mb-3">SSN Card</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <IdentityFileCard path={identityPaths.ssnFront} subtitle="Front" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-semibold text-slate-900">Driver&apos;s License</p>
                  <p className="text-[11px] text-slate-500">front only</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <IdentityFileCard path={identityPaths.dlFront} subtitle="Front" />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-4">Only PNG, JPG, or PDF • Max 10 MB per file</p>
          </div>

          {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}
          {zohoNote && <p className="mb-4 text-[#0D9488] text-sm">{zohoNote}</p>}

          <div className="mt-auto flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-[#0D9488] bg-white px-6 py-2 text-[12px] font-medium text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAndContinue()}
              disabled={saving || !agreed || !identityDocsComplete}
              className={`rounded-lg px-6 py-2 text-[12px] font-medium text-white transition ${
                saving || !agreed || !identityDocsComplete
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-[#0D9488] hover:bg-[#0b7a70]"
              }`}
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
