"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import toast, { Toaster } from "react-hot-toast"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"

interface FileInfo {
  name: string
  size: string
  file?: File
}

interface FilesState {
  license: FileInfo | null
  tb: FileInfo | null
  cpr: FileInfo | null
}

interface FileRowProps {
  file: FileInfo | null
  type: keyof FilesState
  removeFile: (type: keyof FilesState) => void
}

const FileRow = ({ file, type, removeFile }: FileRowProps) => {
  if (!file) return null


  return (
    <div className="flex h-[72px] w-full items-center justify-between gap-3 rounded-lg border border-[#1db4a3] bg-[#ecfffd] px-4 md:w-[650px]">
      <div className="flex min-w-0 items-center gap-3">
        <Image
          src="/icons/jpeg-icon.svg"
          alt="JPEG icon"
          width={24}
          height={24}
          className="h-6 w-6 flex-none"
        />

        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold leading-5 text-[#0b7f74]">
            {file.name}
          </p>
          <p className="text-[11px] font-normal leading-4 text-slate-500">
            {file.size}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => removeFile(type)}
        className="cursor-pointer rounded-md p-2 transition hover:bg-white/70"
        aria-label={`Delete ${file.name}`}
      >
        <Image
          src="/icons/delete-icon.svg"
          alt="Delete"
          width={24}
          height={24}
          className="h-6 w-6"
        />
      </button>
    </div>
  )
}

export default function Step2ReviewReq() {
  const router = useRouter()

  const fileInput = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [agree, setAgree] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [fileRequiredError, setFileRequiredError] = useState<string | null>(null)
  const [termsRequiredError, setTermsRequiredError] = useState<string | null>(null)

  function saveResumeFileToLocalStorage(selected: File) {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error("Failed to read the file"))
      reader.onload = () => {
        localStorage.setItem("resumeFile", String(reader.result || ""))
        resolve()
      }
      reader.readAsDataURL(selected)
    })
  }

  function persistSelectedFile(selected: File) {
    localStorage.setItem("resumeName", selected.name)
    localStorage.setItem("resumeSizeBytes", String(selected.size))
    localStorage.setItem("resumeMimeType", selected.type || "")
    // Clear previous parsing results when choosing a new file.
    localStorage.removeItem("parsedResume")

    // Keep previous working behavior: store the actual file payload too.
    saveResumeFileToLocalStorage(selected).catch(() => {
      // Best-effort: user can still continue; we'll surface an error on "Next" if needed.
    })
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFileRequiredError(null)
    setTermsRequiredError(null)

    // ✅ SIZE VALIDATION
    if (selected.size > 10 * 1024 * 1024) {
      alert("Max file size is 10MB")
      return
    }

    setFile(selected)
    persistSelectedFile(selected)

    // Allows selecting the same file again to retrigger `onChange`.
    e.target.value = ""
  }

  function browse() {
    fileInput.current?.click()
  }

  function drop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const dropped = e.dataTransfer.files[0]
    if (!dropped) return

    setFileRequiredError(null)
    setTermsRequiredError(null)

    if (dropped.size > 10 * 1024 * 1024) {
      alert("Max file size is 10MB")
      return
    }

    setFile(dropped)
    persistSelectedFile(dropped)
  }

  function dragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(true)
  }

  function dragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
  }

  function next() {
    if (!file) {
      setFileRequiredError("Please upload your resume *")
      return
    }

    if (!agree) {
      setTermsRequiredError("Please accept Terms & Conditions *")
      return
    }

    ; (async () => {
      setParsing(true)
      setParseError(null)
      try {
        // Ensure the actual file payload is persisted (older flow relied on this).
        persistSelectedFile(file)
        await saveResumeFileToLocalStorage(file)
        router.push("/application/step-1-success")
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Failed to store resume file"
        setParseError(msg)
      } finally {
        setParsing(false)
      }
    })()
  }
  const [files, setFiles] = useState<FilesState>(() => {
    if (typeof window === "undefined") {
      return { license: null, tb: null, cpr: null }
    }

    const stored = localStorage.getItem("step2_files")

    if (!stored) {
      return { license: null, tb: null, cpr: null }
    }

    return JSON.parse(stored)
  })

  function removeFile(type: keyof FilesState) {
    setFiles((prev) => {
      const updated = {
        ...prev,
        [type]: null
      }

      localStorage.setItem("step2_files", JSON.stringify(updated))

      return updated
    })
  }

  async function saveRequirements() {
    const toastId = toast.loading("Saving requirements...")

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("User not logged in", { id: toastId })
        return
      }

      const workerId = user.id

      for (const [type, file] of Object.entries(files)) {
        if (!file || !file.file) continue

        const path = `${workerId}/${type}-${Date.now()}-${file.name}`

        const { error: uploadError } = await supabase.storage
          .from("worker_required_files")
          .upload(path, file.file)

        if (uploadError) {
          toast.error(uploadError.message, { id: toastId })
          return
        }

        const { error: insertError } = await supabase
          .from("worker_required_files")
          .insert({
            worker_id: workerId,
            file_type: type,
            file_url: path
          })

        if (insertError) {
          toast.error(insertError.message, { id: toastId })
          return
        }
      }

      toast.success("Requirements saved", { id: toastId })

      setTimeout(() => {
        router.push("/application/step-3-skills")
      }, 1200)
    } catch {
      toast.error("Unexpected error", { id: toastId })
    }
  }

  return (
    <>
      <Toaster position="top-center" />

      <OnboardingLayout
        // cardClassName="md:h-[712px] md:min-h-[712px]"
        rightPanelContentClassName="p-5"
        rightPanelImageSrc="/images/step-2-license-bg-image.jpg"
        rightPanelImageClassName="opacity-50 object-top"
        rightPanelOverlayClassName="bg-white/0"
      >
        <div className="flex h-full flex-col px-10 pb-10 pt-6">
          <OnboardingStepper currentStep={2} completedThrough={2} />

          <div className="flex flex-1 flex-col pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-[24px] font-semibold leading-8 text-slate-800">
                Add Requirements
              </h2>

              <button
                type="button"
                onClick={() => router.push("/application/step-3-skills")}
                className="inline-flex cursor-pointer items-center gap-2 text-[12px] font-semibold leading-5 text-[#1db4a3]"
              >
                Skip for Now
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <div className="space-y-3">
                <p className="text-[16px] font-semibold leading-6 text-slate-800">
                  Nursing License
                </p>
                <FileRow
                  file={files.license}
                  type="license"
                  removeFile={removeFile}
                />
              </div>
              <div className="space-y-3">
                <p className="text-[16px] font-semibold leading-6 text-slate-800">
                  TB Test
                </p>
                <FileRow file={files.tb} type="tb" removeFile={removeFile} />
                
              </div>

              <div className="space-y-3">
                <p className="text-[16px] font-semibold leading-6 text-slate-800">
                  CPR Certifications
                </p>
                <FileRow file={files.cpr} type="cpr" removeFile={removeFile} />
                
              </div>
            </div>

            <p className="mt-4 text-sm font-normal leading-4 text-slate-500">
              Only support png, jpg or pdf files
            </p>

            <div className="mt-auto flex items-center justify-end gap-4 pt-8">
              <button
                type="button"
                onClick={() => router.back()}
                className="cursor-pointer inline-flex h-11 w-[66px] items-center justify-center rounded-lg border border-[#1db4a3] text-sm font-semibold leading-5 text-[#1db4a3] transition hover:bg-[#ecfffd]"
              >
                Back
              </button>

              <button
                type="button"
                onClick={saveRequirements}
                className="cursor-pointer inline-flex h-11 w-[92px] p-4 items-center justify-between rounded-lg bg-[#1db4a3] text-sm font-semibold leading-5 text-white transition hover:bg-[#189d8e]"
              >
                Next
                <ChevronRight className="h-4 w-4 font-semibold" />

              </button>
            </div>
          </div>
        </div>
      </OnboardingLayout>
    </>
  )
}
