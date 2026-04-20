"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { CheckCircle2, Pencil } from "lucide-react"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import OnboardingSuccessPopup from "@/app/components/OnboardingSuccessPopup"

interface IdentityDoc { name: string; url: string }
interface IdentityDocs { ssn?: IdentityDoc; license?: IdentityDoc; uploadedAt?: string }
interface ResumeData { first_name?: string; last_name?: string; job_role?: string; fileName?: string; [key: string]: unknown }

function SummaryCard({
  title,
  subtitle,
  editHref,
}: {
  title: string
  subtitle?: string
  editHref?: string
}) {
  return (
    <div className="group flex items-center justify-between rounded-xl border border-[#0D9488] bg-[#f0fffe] px-4 py-3">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#0D9488]" />
        <div>
          <p className="text-[13px] font-semibold text-slate-800">{title}</p>
          {subtitle ? <p className="text-[11px] text-[#0D9488]">{subtitle}</p> : null}
        </div>
      </div>
      {editHref ? (
        <Link
          href={editHref}
          aria-label={`Edit ${title}`}
          className="rounded p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-slate-600"
        >
          <Pencil className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  )
}

export default function SummaryPage() {
  const router = useRouter()

  const [resumeData, setResumeData] = useState<ResumeData | null>(null)
  const [identityDocs, setIdentityDocs] = useState<IdentityDocs | null>(null)
  const [skillStatus, setSkillStatus] = useState<string>("3 of 3 Completed")
  const [referencesCount, setReferencesCount] = useState<number>(3)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let isMounted = true

    const storedResume = localStorage.getItem("parsedResume")
    if (storedResume && isMounted) {
      try { setResumeData(JSON.parse(storedResume)) } catch (e) { console.error(e) }
    }

    const storedIdentity = localStorage.getItem("identityDocuments")
    if (storedIdentity && isMounted) {
      try {
        const parsed = JSON.parse(storedIdentity)
        if (parsed?.uploadedAt) {
          const uploadedTime = new Date(parsed.uploadedAt).getTime()
          if (uploadedTime > Date.now() - 60 * 60 * 1000) {
            setIdentityDocs(parsed)
          } else {
            localStorage.removeItem("identityDocuments")
          }
        }
      } catch (e) { console.error(e); localStorage.removeItem("identityDocuments") }
    }

    const storedSkill = localStorage.getItem("skillStatus")
    if (storedSkill && isMounted) setSkillStatus(storedSkill)

    const storedRefs = localStorage.getItem("referencesCount")
    if (storedRefs && isMounted) setReferencesCount(Number(storedRefs) || 0)

    return () => { isMounted = false }
  }, [])

  const handleFinalSubmit = () => {
    setLoading(true)
    setSuccess(true)
    setTimeout(() => {
      localStorage.removeItem("parsedResume")
      localStorage.removeItem("identityDocuments")
      localStorage.removeItem("skillStatus")
      localStorage.removeItem("referencesCount")
      router.push("/application/success")
    }, 3000)
  }

  const resumeFileName = resumeData?.fileName ||
    (resumeData?.first_name ? `${resumeData.first_name.toLowerCase()}${resumeData.last_name ? resumeData.last_name.toLowerCase() : ""}-resume.pdf` : "johndoe-resume.pdf")

  // Count completed sections for "X of 4 Completed"
  const completedCount = [
    !!resumeData,
    true, // requirements assumed
    true, // skill assessment
    true, // authorizations
  ].filter(Boolean).length

  return (
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageSrc="/images/main-doctor.jpg"
      rightPanelImageClassName="opacity-50 object-top"
      rightPanelOverlayClassName="bg-white/50"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper currentStep={6} completedThrough={6} />

        <div className="flex flex-1 flex-col pt-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[24px] font-semibold leading-8 text-slate-800">Summary</h2>
            <span className="text-[12px] font-medium text-slate-500">{completedCount} of 4 Completed</span>
          </div>

          <div className="space-y-6">
            {/* Resume Uploaded */}
            <div>
              <p className="text-[13px] font-semibold text-slate-700 mb-2">Resume Uploaded</p>
              <SummaryCard
                title="Resume Uploaded"
                subtitle={resumeFileName}
                editHref="/application/step-1-upload-v2"
              />
            </div>

            {/* Requirements */}
            <div>
              <p className="text-[13px] font-semibold text-slate-700 mb-2">Requirements</p>
              <div className="space-y-2">
                <SummaryCard title="Nursing License" subtitle="Nursing-license.png" editHref="/application/step-2-license" />
                <SummaryCard title="TB Test" subtitle="tb-test.png" editHref="/application/step-2-license" />
                <SummaryCard title="CPR Certifications" subtitle="cpr-cert.jpg" editHref="/application/step-2-license" />
              </div>
            </div>

            {/* Skill Assessment */}
            <div>
              <p className="text-[13px] font-semibold text-slate-700 mb-2">Skill Assessment</p>
              <SummaryCard title={skillStatus} editHref="/application/step-3-assessment" />
            </div>

            {/* Authorizations & Documents */}
            <div>
              <p className="text-[13px] font-semibold text-slate-700 mb-2">Authorizations &amp; Documents</p>
              <div className="space-y-2">
                <SummaryCard title="Authorization-Agreement" subtitle="Signed" editHref="/application/step-4-documents" />
                <SummaryCard
                  title="SSN Card"
                  subtitle={identityDocs?.ssn ? identityDocs.ssn.name : "Signed"}
                  editHref="/application/step-4-documents"
                />
                <SummaryCard
                  title="Driver's License"
                  subtitle={identityDocs?.license ? identityDocs.license.name : "Signed"}
                  editHref="/application/step-4-documents"
                />
              </div>
            </div>

            {/* References */}
            <div>
              <p className="text-[13px] font-semibold text-slate-700 mb-2">References</p>
              <SummaryCard title={`${referencesCount} of 3 Added`} editHref="/application/step-5-add-references" />
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-auto flex items-center justify-end gap-3 pt-8">
            <button
              type="button"
              onClick={() => router.back()}
              className="cursor-pointer rounded-md border border-[#0D9488] bg-white px-5 py-2 text-[12px] font-medium leading-5 text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={loading}
              className={`cursor-pointer rounded-md px-6 py-2 text-[12px] font-medium leading-5 text-white transition ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-[#0D9488] hover:bg-[#0b7a70]"
              }`}
            >
              {loading ? "Finalizing..." : "Save & continue"}
            </button>
          </div>
        </div>
      </div>
      <OnboardingSuccessPopup
        open={success}
        onContinue={() => {
          localStorage.removeItem("parsedResume")
          localStorage.removeItem("identityDocuments")
          localStorage.removeItem("skillStatus")
          localStorage.removeItem("referencesCount")
          router.push("/application/success")
        }}
      />
    </OnboardingLayout>
  )
}
