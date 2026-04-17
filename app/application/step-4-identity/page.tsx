"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ChevronRight } from "lucide-react"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { WORKER_REQUIRED_FILES_BUCKET } from "@/lib/supabase-storage-buckets"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"

type UploadSlot = { file: File | null }

export default function Step4Identity() {
  const router = useRouter()

  const [ssnFile, setSsnFile] = useState<UploadSlot>({ file: null })
  const [licenseFile, setLicenseFile] = useState<UploadSlot>({ file: null })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFile = async (
    file: File,
    folder: string,
    applicantId: string
  ): Promise<string> => {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("folder", folder)
    fd.append("applicantId", applicantId)

    const res = await fetch("/api/onboarding/upload-required-file", {
      method: "POST",
      body: fd,
    })

    const json = (await res.json().catch(() => ({}))) as {
      error?: string
      publicUrl?: string
    }

    if (!res.ok) {
      throw new Error(json.error || "File upload failed")
    }
    if (!json.publicUrl) {
      throw new Error("Could not generate public URL")
    }

    return json.publicUrl
  }

  const handleNext = async () => {
    setError(null)
    if (!ssnFile.file || !licenseFile.file) {
      setError("Please upload both SSN Card and Driver's License")
      return
    }
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const applicantId = userData?.user?.id || localStorage.getItem("applicantId") || ""
      if (!applicantId) {
        throw new Error("Missing applicant ID")
      }
      localStorage.setItem("applicantId", applicantId)

      const ssnUrl = await uploadFile(ssnFile.file, "ssn", applicantId)
      const licenseUrl = await uploadFile(licenseFile.file, "license", applicantId)

      const { error: dbError } = await supabase.from("worker_documents").insert({
        applicant_id: applicantId,
        ssn_url: ssnUrl,
        drivers_license_url: licenseUrl,
        uploaded_at: new Date().toISOString(),
      })
      if (dbError) throw dbError

      localStorage.setItem(
        "identityDocuments",
        JSON.stringify({
          ssn: { name: ssnFile.file.name, url: ssnUrl },
          license: { name: licenseFile.file.name, url: licenseUrl },
          uploadedAt: new Date().toISOString(),
        })
      )
      setSsnFile({ file: null })
      setLicenseFile({ file: null })
      router.push("/application/step-4-documents")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    router.push("/application/step-4-documents")
  }

  const UploadBox = ({
    id,
    slot,
    setSlot,
  }: {
    id: string
    slot: UploadSlot
    setSlot: (s: UploadSlot) => void
  }) => (
    <label
      htmlFor={id}
      className="block cursor-pointer rounded-xl border border-dashed border-[#0D9488] bg-white px-6 py-8 text-center transition hover:bg-[#f0fffe]"
    >
      <input
        id={id}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/jpg,application/pdf"
        onChange={(e) => {
          if (e.target.files?.[0]) setSlot({ file: e.target.files[0] })
        }}
      />
      {slot.file ? (
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-[#0D9488]">{slot.file.name}</p>
          <p className="text-[11px] text-slate-400">
            {(slot.file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e6faf8]">
            <Image src="/images/upload.svg" alt="" width={22} height={22} />
          </div>
          <p className="text-[13px] text-slate-600">Drag your file(s) to start uploading</p>
          <p className="text-[11px] text-slate-400">OR</p>
          <span className="rounded-md border border-[#0D9488] px-4 py-1 text-[12px] font-medium text-[#0D9488] hover:bg-[#f0fffe]">
            Browse files
          </span>
          <p className="text-[10px] text-slate-400">Max 10 MB files are allowed</p>
        </div>
      )}
    </label>
  )

  return (
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageSrc="/images/n1.jpg"
      rightPanelImageClassName="opacity-50 object-top"
      rightPanelOverlayClassName="bg-white/50"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper currentStep={4} completedThrough={3} />

        <div className="flex flex-1 flex-col pt-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[24px] font-semibold leading-8 text-slate-800">
              SSN &amp; Driver&apos;s License
            </h2>
            <button
              type="button"
              onClick={handleSkip}
              className="cursor-pointer text-[12px] font-medium leading-5 text-[#0D9488]"
            >
              Skip for Now →
            </button>
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-[12px] text-red-600">
              {error}
            </p>
          )}

          <div className="space-y-6">
            {/* SSN Card */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-semibold text-slate-800">SSN Card</p>
                <p className="text-[11px] text-slate-400">front/back</p>
              </div>
              <UploadBox id="ssn-upload" slot={ssnFile} setSlot={setSsnFile} />
            </div>

            {/* Driver's License */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-semibold text-slate-800">Driver&apos;s License</p>
                <p className="text-[11px] text-slate-400">front/back</p>
              </div>
              <UploadBox id="license-upload" slot={licenseFile} setSlot={setLicenseFile} />
            </div>

            <p className="text-[11px] text-slate-400">Only support png, jpg or pdf files</p>
          </div>

          {/* Buttons */}
          <div className="mt-auto flex items-center justify-end gap-3 pt-8">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={loading}
              className="cursor-pointer rounded-md border border-[#0D9488] bg-white px-5 py-2 text-[12px] font-medium leading-5 text-[#0D9488] transition hover:bg-[#f0fffe] disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className={`group inline-flex cursor-pointer items-center gap-2 rounded-md px-6 py-2 text-[12px] font-medium leading-5 text-white transition ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-[#0D9488] hover:bg-[#0b7a70]"
              }`}
            >
              {loading ? "Uploading..." : "Next"}
              {!loading && <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
