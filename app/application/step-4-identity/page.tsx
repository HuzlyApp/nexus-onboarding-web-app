// app/application/step-4-identity/page.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets"

import OnboardingLayout from "../../components/OnboardingLayout"
import StepProgress from "../../components/StepProgress"
import FileUploadBox from "../../components/FileUploadBox"

const MAX_BYTES = 10 * 1024 * 1024

export default function Step4Identity() {
  const router = useRouter()

  const [ssnFront, setSsnFront] = useState<File | null>(null)
  const [dlFront, setDlFront] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = async (
    file: File,
    applicantId: string,
    segment: "ssn_front" | "dl_front"
  ): Promise<string> => {
    if (file.size > MAX_BYTES) {
      throw new Error("Each file must be 10 MB or smaller.")
    }
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const folder = segment === "ssn_front" ? "ssn" : "drivers_license"
    const storagePath = `${folder}/${applicantId}/${segment}-${Date.now()}-${sanitizedName}`

    const { error: uploadError } = await supabase.storage.from(WORKER_REQUIRED_FILES_BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/octet-stream",
    })

    if (uploadError) throw new Error(uploadError.message || "File upload failed")

    return storagePath
  }

  const handleNext = async () => {
    setError(null)

    if (!ssnFront || !dlFront) {
      setError("Please upload both files: SSN (front) and driver's license (front).")
      return
    }

    setLoading(true)

    try {
      const { data: userData, error: authErr } = await supabase.auth.getUser()
      const user = userData?.user
      if (authErr || !user) {
        throw new Error("Please sign in to save your documents.")
      }

      const applicantId = user.id
      localStorage.setItem("applicantId", applicantId)

      const [pSsnF, pDlF] = await Promise.all([
        uploadFile(ssnFront, applicantId, "ssn_front"),
        uploadFile(dlFront, applicantId, "dl_front"),
      ])

      const res = await fetch("/api/onboarding/worker-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId,
          ssn_url: supabase.storage.from(WORKER_REQUIRED_FILES_BUCKET).getPublicUrl(pSsnF).data.publicUrl,
          drivers_license_url: supabase.storage.from(WORKER_REQUIRED_FILES_BUCKET).getPublicUrl(pDlF).data.publicUrl,
        }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || "Could not save to worker documents")

      const url = (path: string) => supabase.storage.from(WORKER_REQUIRED_FILES_BUCKET).getPublicUrl(path).data.publicUrl

      localStorage.setItem(
        "identityDocuments",
        JSON.stringify({
          ssnFront: { name: ssnFront.name, path: pSsnF, url: url(pSsnF) },
          dlFront: { name: dlFront.name, path: pDlF, url: url(pDlF) },
          uploadedAt: new Date().toISOString(),
        })
      )

      setSsnFront(null)
      setDlFront(null)

      router.push("/application/step-4-documents")
    } catch (err: unknown) {
      console.error("Upload/save error:", err)
      const message = err instanceof Error ? err.message : "Something went wrong"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    router.push("/application/step-4-documents")
  }

  const canSubmit = Boolean(ssnFront && dlFront) && !loading

  return (
    <OnboardingLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 w-full">
        <div className="flex justify-end mb-2">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm font-medium text-teal-700 hover:text-teal-900"
          >
            Skip for Now &gt;
          </button>
        </div>

        <StepProgress />

        <h2 className="text-xl sm:text-2xl font-semibold text-black mb-6">SSN &amp; Driver&apos;s License</h2>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <div className="space-y-8">
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-3">SSN card</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Front *</label>
                <FileUploadBox
                  inputId="identity-ssn-front"
                  file={ssnFront}
                  setFile={setSsnFront}
                  accept="image/png,image/jpeg,image/jpg,application/pdf"
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-3">Driver&apos;s license</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Front *</label>
                <FileUploadBox
                  inputId="identity-dl-front"
                  file={dlFront}
                  setFile={setDlFront}
                  accept="image/png,image/jpeg,image/jpg,application/pdf"
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">Only PNG, JPG, or PDF • Max 10 MB per file</p>
        </div>

        <div className="flex justify-end gap-4 mt-10">
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={!canSubmit}
            className={`px-6 py-2.5 min-w-[160px] rounded-lg text-white font-medium transition ${
              !canSubmit ? "bg-gray-400 cursor-not-allowed" : "bg-teal-600 hover:bg-teal-700 shadow-sm"
            }`}
          >
            {loading ? "Saving…" : "Save & Continue"}
          </button>
        </div>
      </div>
    </OnboardingLayout>
  )
}