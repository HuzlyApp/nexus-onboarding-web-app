"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"

type TermsSection = {
  title: string
  content: string
}

const TERMS_SECTIONS: TermsSection[] = [
  { title: "1. Acceptance", content: "By using Nexus MedPro Staffing, you agree to these Terms & Conditions." },
  { title: "2. Eligibility", content: "You must provide true details and valid work credentials." },
  { title: "3. Account Use", content: "Keep your login details safe. You are responsible for account activity." },
  { title: "4. Resume Data", content: "You allow us to parse resume details and use them for onboarding." },
  { title: "5. Background Verification", content: "Some roles may require document checks and credential verification." },
  { title: "6. Communication", content: "You agree to receive email/SMS updates for onboarding progress." },
  { title: "7. Privacy", content: "Your personal information is handled according to our privacy policy." },
  { title: "8. Prohibited Conduct", content: "Do not provide fake details or misuse the platform in any way." },
  { title: "9. Liability", content: "Nexus MedPro Staffing is not responsible for indirect or incidental damages." },
  { title: "10. Governing Law", content: "These Terms are governed by applicable local laws." },
]

export default function TermsAndConditionsPage() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const content = useMemo(() => TERMS_SECTIONS, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8
    if (reachedBottom) setIsAtBottom(true)
  }

  function handleAccept() {
    if (!agreed) return
    localStorage.setItem("step1TermsAccepted", "true")
    router.push("/application/step-1-success")
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#19c7c0_0%,#10a58f_100%)] flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl p-6 md:p-8">
        <h1 className="text-3xl font-semibold text-slate-900">Terms & Conditions</h1>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="mt-5 h-[420px] overflow-y-auto rounded-lg border border-slate-200 p-4 md:p-6"
        >
          <div className="space-y-5">
            {content.map((section) => (
              <div key={section.title}>
                <h2 className="text-base font-semibold text-slate-900">{section.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-700">{section.content}</p>
              </div>
            ))}
            <p className="pt-2 text-sm font-medium text-slate-900">
              By accepting, you confirm that you have read and understood these Terms & Conditions.
            </p>
          </div>
        </div>

        {isAtBottom ? (
          <div className="mt-5">
            <label className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="h-5 w-5 cursor-pointer appearance-none rounded-full border-2 border-[#1db4a3] checked:bg-[#1db4a3] checked:border-[#1db4a3] relative checked:after:content-[''] checked:after:absolute checked:after:left-[5px] checked:after:top-[1px] checked:after:h-[9px] checked:after:w-[5px] checked:after:rotate-45 checked:after:border-b-2 checked:after:border-r-2 checked:after:border-white"
              />
              <span>I accept the above terms and conditions.</span>
            </label>

            <button
              type="button"
              onClick={handleAccept}
              disabled={!agreed}
              className="mt-4 w-full rounded-md bg-[#0D9488] py-3 text-sm font-semibold text-white transition hover:bg-[#0b7c72] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Accept and Continue
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">Please scroll to the bottom to accept.</p>
        )}
      </div>
    </div>
  )
}
