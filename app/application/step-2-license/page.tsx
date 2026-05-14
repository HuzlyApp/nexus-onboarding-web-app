
"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import AutosaveStatus from "@/app/components/AutosaveStatus"
import { useDropzone } from "react-dropzone"
import { ChevronRight, FileText } from "lucide-react"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"

type UploadFile = {
  file: File | null
  name: string
  size: string
  url?: string
}

type UploadType = "license" | "tb" | "cpr"

export default function Step2License() {
  const router = useRouter()

  const [files, setFiles] = useState<Record<UploadType, UploadFile | null>>(() => {
    if (typeof window === "undefined") {
      return { license: null, tb: null, cpr: null }
    }
    const stored = localStorage.getItem("step2_files")
    if (!stored) return { license: null, tb: null, cpr: null }
    try {
      const parsed = JSON.parse(stored) as Partial<Record<UploadType, Partial<UploadFile> | null>>
      return {
        license: parsed.license?.name
          ? {
              file: null,
              name: parsed.license.name,
              size: parsed.license.size ?? "",
              url: parsed.license.url,
            }
          : null,
        tb: parsed.tb?.name
          ? {
              file: null,
              name: parsed.tb.name,
              size: parsed.tb.size ?? "",
              url: parsed.tb.url,
            }
          : null,
        cpr: parsed.cpr?.name
          ? {
              file: null,
              name: parsed.cpr.name,
              size: parsed.cpr.size ?? "",
              url: parsed.cpr.url,
            }
          : null,
      }
    } catch {
      return { license: null, tb: null, cpr: null }
    }
  })
  const [error, setError] = useState<string | null>(null)
  const [fileAutosave, setFileAutosave] = useState<"idle" | "saved">("idle")
  const [saving, setSaving] = useState(false)
  const hasAnyUpload = Boolean(files.license || files.tb || files.cpr)

  useEffect(() => {
    const serializable = Object.fromEntries(
      (Object.entries(files) as Array<[UploadType, UploadFile | null]>).map(([type, value]) => [
        type,
        value
          ? {
              name: value.name,
              size: value.size,
              url: value.url,
            }
          : null,
      ])
    )
    localStorage.setItem("step2_files", JSON.stringify(serializable))
    setFileAutosave("saved")
    const t = window.setTimeout(() => setFileAutosave("idle"), 1200)
    return () => window.clearTimeout(t)
  }, [files])

  const handleUpload = (file: File, type: UploadType) => {
    setError(null)
    setFiles((prev) => ({
      ...prev,
      [type]: {
        file,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`
      }
    }))
  }

  const uploadFile = async (
    file: File,
    folder: UploadType,
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
      throw new Error(json.error || `Could not upload ${folder} file`)
    }
    if (!json.publicUrl) {
      throw new Error(`Could not generate ${folder} file URL`)
    }
    return json.publicUrl
  }

  const UploadBox = ({
    type,
    label,
    hint
  }: {
    type: UploadType
    label: string
    hint?: string
  }) => {
    const onDrop = (acceptedFiles: File[]) => {
      if (!acceptedFiles[0]) return
      handleUpload(acceptedFiles[0], type)
    }

    const { getRootProps, getInputProps } = useDropzone({
      onDrop,
      accept: {
        "image/*": [],
        "application/pdf": []
      }
    })

    const file = files[type]

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[16px] font-semibold leading-6 text-slate-800">
            {label}
          </p>
          {hint ? (
            <p className="text-[10px] font-normal leading-4 text-slate-500">
              {hint}
            </p>
          ) : null}
        </div>

        {file ? (
          <div className="flex items-center justify-between rounded-lg border border-[#98e1d8] bg-[#ecfffd] px-4 py-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[#1db4a3]" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium leading-5 text-slate-800">
                  {file.name}
                </p>
                <p className="text-[11px] font-normal leading-4 text-slate-600">
                  {file.size}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setFiles((prev) => ({
                  ...prev,
                  [type]: null
                }))
              }
              className="cursor-pointer rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label={`Remove ${label}`}
            >

              {/* <Trash2 size={18} /> */}
              <Image
                        src="/icons/delete-icon.svg"
                        alt="Delete"
                        width={24}
                        height={24}
                        className="h-6 w-6"
                      />
            </button>
          </div>
        ) : (
          <div
            {...getRootProps()}
            className="w-full cursor-pointer rounded-xl border border-dashed border-[#78d7cc] px-6 py-6 text-center transition hover:bg-slate-50 min-h-51.5"
          >
            <input {...getInputProps()} />

            <div className="mx-auto flex h-full max-w-90 flex-col items-center justify-center gap-3">
              <Image
                src="/images/upload.svg"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9"
                priority
              />

              <p className="text-[12px] font-normal leading-5 text-slate-800">
                Drag your file(s) to start uploading
              </p>

              <p className="text-[10px] font-normal leading-4 text-slate-400">
                OR
              </p>

              <button
                type="button"
                className="cursor-pointer rounded-md border border-[#1db4a3] px-4 py-1 text-[12px] font-medium leading-5 text-[#1db4a3] transition hover:bg-[#ecfffd]"
              >
                Browse files
              </button>

              <p className="text-[10px] font-normal leading-4 text-slate-500">
                Max 10 MB files are allowed
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }


  const goNext = async () => {
    if (!hasAnyUpload) {
      setError("Please upload at least one required document before continuing.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      let applicantId = localStorage.getItem("applicantId")?.trim() || ""
      if (!applicantId) {
        const { data: userData } = await supabase.auth.getUser()
        applicantId = userData?.user?.id?.trim() || ""
      }
      if (!applicantId) {
        throw new Error("Missing applicant ID — complete Step 1 (review profile) first.")
      }
      localStorage.setItem("applicantId", applicantId)

      const nextFiles: Record<UploadType, UploadFile | null> = { ...files }
      const payload: {
        applicantId: string
        nursing_license_url?: string
        tb_test_url?: string
        cpr_certification_url?: string
      } = { applicantId }

      const mapping: Array<[UploadType, keyof Omit<typeof payload, "applicantId">]> = [
        ["license", "nursing_license_url"],
        ["tb", "tb_test_url"],
        ["cpr", "cpr_certification_url"],
      ]

      for (const [type, field] of mapping) {
        const slot = nextFiles[type]
        if (!slot) continue
        const url = slot.file ? await uploadFile(slot.file, type, applicantId) : slot.url
        if (url) {
          payload[field] = url
          nextFiles[type] = { ...slot, file: null, url }
        }
      }

      if (
        !payload.nursing_license_url &&
        !payload.tb_test_url &&
        !payload.cpr_certification_url
      ) {
        throw new Error("Select the document files again so they can be uploaded.")
      }

      const docRes = await fetch("/api/onboarding/worker-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const docJson = (await docRes.json().catch(() => ({}))) as { error?: string }
      if (!docRes.ok) {
        throw new Error(docJson.error || `Could not save document URLs (${docRes.status})`)
      }

      setFiles(nextFiles)
      router.push("/application/step-3-skills")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingLayout
      cardClassName="md:min-w-0 md:max-w-[950px] md:w-full md:grid-cols-[2fr_1fr] md:h-auto md:min-h-[0]"
      rightPanelContentClassName="p-5"
      rightPanelImageSrc="/images/step-2-license-bg-image.jpg"
      rightPanelImageClassName="opacity-90 object-top"
      rightPanelOverlayClassName="bg-white/70"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper currentStep={2} />

        <div className="flex flex-1 flex-col pt-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[24px] font-semibold leading-8 text-slate-800">
              Add Requirements
            </h2>

            <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
              <AutosaveStatus state={fileAutosave === "saved" ? "saved" : "idle"} />
              <button
                type="button"
                onClick={() => router.push("/application/step-3-skills")}
                className="cursor-pointer text-[12px] font-medium leading-5 text-[#1db4a3]"
              >
                Skip for Now {"\u2192"}
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-6">
            <UploadBox type="license" label="Nursing License" hint="front/back" />
            <UploadBox type="tb" label="TB Test" hint="last 12 months" />
            <UploadBox type="cpr" label="CPR Certifications" />
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" aria-live="polite">
              {error}
            </div>
          ) : null}

          <p className="mt-3 text-[10px] font-normal leading-4 text-slate-500">
            Only support png, jpg or pdf files
          </p>

          <div className="mt-auto flex items-center justify-end gap-3 pt-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="cursor-pointer rounded-md border border-[#1db4a3] px-5 py-2 text-[12px] font-medium leading-5 text-[#1db4a3] transition hover:bg-[#ecfffd]"
            >
              Back
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={!hasAnyUpload || saving}
              className="group inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#1db4a3] px-6 py-2 text-[12px] font-medium leading-5 text-white transition hover:bg-[#189d8e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save & Continue"}
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}

