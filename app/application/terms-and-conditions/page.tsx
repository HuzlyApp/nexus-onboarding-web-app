"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import OnboardingCheckbox from "@/app/components/OnboardingCheckbox"

type TermsSection = {
  title: string
  content: string
}

export default function TermsAndConditionsPage() {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [content, setContent] = useState<TermsSection[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch("/api/onboarding/terms", { cache: "no-store" })
        const json = (await res.json()) as Array<{ title?: unknown; content?: unknown }> & {
          error?: string
        }
        if (!res.ok) throw new Error((json as { error?: string }).error || "Failed to load terms")
        if (cancelled) return
        const rows = Array.isArray(json)
          ? json
              .map((row) => ({
                title: typeof row.title === "string" ? row.title : "",
                content: typeof row.content === "string" ? row.content : "",
              }))
              .filter((row) => row.title && row.content)
          : []
        setContent(rows)
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : "Failed to load terms")
        setContent([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8
    if (reachedBottom) {
      setIsAtBottom(true)
      if (typeof window !== "undefined") {
        localStorage.setItem("step1TermsOpened", "true")
      }
    }
  }, [])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8
    if (reachedBottom) {
      setIsAtBottom(true)
      if (typeof window !== "undefined") {
        localStorage.setItem("step1TermsOpened", "true")
      }
    }
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
          {loading ? <p className="text-sm text-slate-600">Loading terms...</p> : null}
          {!loading && loadError ? <p className="text-sm text-red-700">{loadError}</p> : null}
          {!loading && !loadError && content.length === 0 ? (
            <p className="text-sm text-slate-600">No terms content is available yet.</p>
          ) : null}
          {!loading && !loadError && content.length > 0 ? (
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
          ) : null}
        </div>

        {!loading && !loadError && content.length > 0 && isAtBottom ? (
          <div className="mt-5">
            <OnboardingCheckbox
              checked={agreed}
              onChange={setAgreed}
              className="text-sm text-slate-700"
            >
              <span>I accept the above terms and conditions.</span>
            </OnboardingCheckbox>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleAccept}
                disabled={!agreed}
                className="rounded-md bg-[#0D9488] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0b7c72] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Accept and Continue
              </button>
            </div>
          </div>
        ) : !loading && !loadError && content.length > 0 ? (
          <p className="mt-4 text-sm text-slate-600">Please scroll to the bottom to accept.</p>
        ) : null}
      </div>
    </div>
  )
}
