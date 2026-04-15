"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { FileText, Trash2 } from "lucide-react"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"

const DISCLAIMER =
  "By selecting “I Agree,” I authorize the Company to conduct a background check and, if required, a drug screening as part of my application or continued engagement. I understand this may include verification of my identity, employment history, education, and criminal records as permitted by law. I consent to the lawful collection, use, and disclosure of this information and release the Company from liability related to these authorized checks."

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

export default function DocumentsPage() {
  const router = useRouter()

  const [mounted, setMounted] = useState(false)
  const [showAuthPdf, setShowAuthPdf] = useState(false)

  const [applicantId, setApplicantId] = useState<string | null>(null)
  const [agreed, setAgreed] = useState(false)
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
  const [signingLoading, setSigningLoading] = useState(false)
  const [envelopeId, setEnvelopeId] = useState<string | null>(null)
  const [isSigned, setIsSigned] = useState(false)
  const [signingCompleteManual, setSigningCompleteManual] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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
      if (em) setSignerEmail(em)
      if (fn || ln) setSignerName(`${fn} ${ln}`.trim())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!applicantId) return
    void supabase
      .from("worker")
      .select("email, first_name, last_name")
      .eq("user_id", applicantId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.email?.trim()) setSignerEmail(data.email.trim())
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
    setSigningCompleteManual(false)

    try {
      const res = await fetch("/api/zoho-sign/create-embedded-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId,
          email: signerEmail,
          name: signerName,
          origin: typeof window !== "undefined" ? window.location.origin : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to prepare signing session")
      }

      const data = (await res.json()) as {
        signingUrl?: string
        requestId?: string
        actionId?: string
        signingCompleteManual?: boolean
      }

      setSigningUrl(data.signingUrl ?? null)
      setEnvelopeId(data.requestId ?? null)
      setSigningCompleteManual(Boolean(data.signingCompleteManual))
      if (data.requestId) localStorage.setItem("signingRequestId", data.requestId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signing setup failed"
      setError(message)
      // Temporary fallback: if Zoho signing fails, show the PDF so the user can continue.
      setShowAuthPdf(true)
    } finally {
      setSigningLoading(false)
    }
  }, [agreed, applicantId, signerEmail, signerName])

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
      }
    }

    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

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

    if (!isSigned) {
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
      rightPanelImageClassName="opacity-50 object-top"
      rightPanelOverlayClassName="bg-white/50"
    >
      {showAuthPdf && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Auth Release form"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowAuthPdf(false)
          }}
        >
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50">
              <p className="text-sm font-semibold text-gray-900 truncate">Auth Release form.pdf</p>
              <button
                type="button"
                onClick={() => setShowAuthPdf(false)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
            <div className="h-[80vh] bg-white">
              <iframe
                title="Auth Release form"
                src="/docs/Auth%20Release%20form.pdf"
                className="w-full h-full"
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

          <label className="flex items-start gap-3 mb-8 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-5 h-5 accent-[#0D9488]"
            />
            <span className="text-slate-800 font-medium">I Agree to the Authorization</span>
          </label>

          <div className="rounded-3xl border border-[#0D9488] bg-[#f0fffe] p-6 shadow-sm mb-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d3f7f0] text-[#0D9488]">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">Authorization_agreement.pdf</p>
                  <p className="text-xs text-slate-500">Mandatory</p>
                </div>
              </div>

              {!signingUrl && !isSigned && (
                <button
                  type="button"
                  onClick={() => {
                    // If Zoho signing isn't configured (common in local/dev), fall back to showing the PDF.
                    // On live, Zoho env vars will be present and this will launch embedded signing.
                    if (!signerEmail || !signerName || !applicantId) {
                      setShowAuthPdf(true)
                      return
                    }
                    void startSigning()
                  }}
                  disabled={signingLoading || !agreed}
                  className={`rounded-xl px-5 py-2 text-[12px] font-semibold text-white transition ${
                    signingLoading || !agreed ? "bg-gray-400 cursor-not-allowed" : "bg-[#0D9488] hover:bg-[#0b7a70]"
                  }`}
                >
                  {signingLoading ? "Preparing..." : "Click and Sign"}
                </button>
              )}

              {isSigned && (
                <span className="rounded-xl bg-[#0D9488] px-5 py-2 text-[12px] font-semibold text-white">Signed</span>
              )}
            </div>

            {envelopeId && (
              <p className="mt-4 text-xs text-slate-500 truncate">Request ID: {envelopeId}</p>
            )}

            {signingUrl && (
              <div className="mt-5 border border-slate-200 rounded-3xl overflow-hidden">
                <iframe
                  title="Sign document"
                  src={signingUrl}
                  width="100%"
                  height="520"
                  allow="clipboard-write"
                  className="min-h-[520px] w-full"
                />
              </div>
            )}
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
              className="rounded-xl border border-[#0D9488] bg-white px-6 py-2 text-[12px] font-medium text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void handleSaveAndContinue()}
              disabled={saving || !agreed || !identityDocsComplete}
              className={`rounded-xl px-6 py-2 text-[12px] font-medium text-white transition ${
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
