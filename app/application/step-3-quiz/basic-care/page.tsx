"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
// import Image from "next/image"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import {
  BASIC_PATIENT_CARE_CATEGORY_ID,
  BASIC_PATIENT_CARE_QUESTION_LIMIT,
} from "@/lib/basic-patient-care-category"
import { ChevronRight } from "lucide-react"

const CATEGORY_SLUG = "basic-care"
const PAGE_SIZE = 5

type QuestionRow = {
  id: string
  question: string
  /** Present if you add a `description` column later */
  description?: string | null
  quiz_number: number | null
}

type CategoryRow = {
  id: string
  title: string
  description: string | null
}

/** Map legacy index-keyed answers (basic_care) onto current question ids by order. */
function normalizeAnswers(
  raw: unknown,
  questions: QuestionRow[]
): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const out: Record<string, number> = {}
  const keys = Object.keys(o)
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const allUuidKeys = keys.length > 0 && keys.every((k) => uuidLike.test(k))
  if (allUuidKeys) {
    for (const k of keys) {
      const v = o[k]
      if (typeof v === "number" && v >= 1 && v <= 4) out[k] = v
    }
    return out
  }
  const allNumericKeys = keys.length > 0 && keys.every((k) => /^\d+$/.test(k))
  if (allNumericKeys && questions.length) {
    for (const k of keys) {
      const idx = Number(k)
      const v = o[k]
      const q = questions[idx]
      if (q && typeof v === "number" && v >= 1 && v <= 4) out[q.id] = v
    }
    return out
  }
  return out
}

export default function BasicCareQuiz() {
  const router = useRouter()
  const [category, setCategory] = useState<CategoryRow | null>(null)
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(questions.length / PAGE_SIZE) || 1),
    [questions.length]
  )

  const start = (page - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, questions.length)
  const pageQuestions = questions.slice(start, end)

  const loadQuiz = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      const { data: cat, error: cErr } = await supabase
        .from("skill_categories")
        .select("id, title, description")
        .eq("slug", CATEGORY_SLUG)
        .maybeSingle()

      if (cErr) throw cErr
      if (!cat) {
        setCategory(null)
        setQuestions([])
        setLoading(false)
        return
      }

      setCategory(cat as CategoryRow)

      let qBuilder = supabase
        .from("skill_questions")
        .select("id, question, quiz_number")
        .eq("category_id", cat.id)
        .order("quiz_number", { ascending: true, nullsFirst: false })

      if (cat.id === BASIC_PATIENT_CARE_CATEGORY_ID) {
        qBuilder = qBuilder.limit(BASIC_PATIENT_CARE_QUESTION_LIMIT)
      }

      const { data: qs, error: qErr } = await qBuilder

      if (qErr) throw qErr
      const ordered = (qs ?? []) as QuestionRow[]
      setQuestions(ordered)

      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        setLoading(false)
        return
      }

      let raw: unknown = null
      const { data: rowNew } = await supabase
        .from("skill_assessments")
        .select("answers")
        .eq("user_id", user.id)
        .eq("category", CATEGORY_SLUG)
        .maybeSingle()

      if (rowNew?.answers) raw = rowNew.answers
      else {
        const { data: rowLegacy } = await supabase
          .from("skill_assessments")
          .select("answers")
          .eq("user_id", user.id)
          .eq("category", "basic_care")
          .maybeSingle()
        if (rowLegacy?.answers) raw = rowLegacy.answers
      }

      setAnswers(normalizeAnswers(raw, ordered))
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : e &&
              typeof e === "object" &&
              "message" in e &&
              typeof (e as { message: unknown }).message === "string"
            ? (e as { message: string }).message
            : "Failed to load quiz"
      setLoadError(msg)
      console.error("[basic-care quiz]", e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQuiz()
  }, [loadQuiz])

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const selectAnswer = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const pageComplete = () => {
    for (let i = start; i < end; i++) {
      const q = questions[i]
      if (!q || answers[q.id] == null) return false
    }
    return true
  }

  async function persist(completed: boolean) {
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      alert("Please sign in to save your assessment.")
      return false
    }
    const user = userData.user
    const cleanAnswers = JSON.parse(JSON.stringify(answers)) as Record<string, number>

    const { data: existing, error: findErr } = await supabase
      .from("skill_assessments")
      .select("id")
      .eq("user_id", user.id)
      .eq("category", CATEGORY_SLUG)
      .maybeSingle()

    if (findErr) {
      console.error(findErr)
      alert(findErr.message)
      return false
    }

    if (existing?.id) {
      const { error: upErr } = await supabase
        .from("skill_assessments")
        .update({
          answers: cleanAnswers,
          completed,
        })
        .eq("id", existing.id)

      if (upErr) {
        console.error(upErr)
        alert(upErr.message)
        return false
      }
    } else {
      const { error: insErr } = await supabase.from("skill_assessments").insert({
        user_id: user.id,
        category: CATEGORY_SLUG,
        answers: cleanAnswers,
        completed,
      })

      if (insErr) {
        console.error(insErr)
        alert(insErr.message)
        return false
      }
    }

    if (completed) {
      localStorage.setItem("basic_care_done", "true")
    }
    return true
  }

  async function saveAndFinish() {
    setSaving(true)
    try {
      const ok = await persist(true)
      if (ok) router.push("/application/step-3-assessment")
    } finally {
      setSaving(false)
    }
  }

  async function next() {
    if (questions.length === 0) {
      router.push("/application/step-3-assessment")
      return
    }

    if (!pageComplete()) {
      alert("Please answer all questions on this page.")
      return
    }

    if (page >= totalPages) {
      await saveAndFinish()
      return
    }

    setSaving(true)
    try {
      const ok = await persist(false)
      if (ok) setPage((p) => p + 1)
    } finally {
      setSaving(false)
    }
  }

  function back() {
    if (page > 1) setPage((p) => p - 1)
    else router.back()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teal-600 text-white text-sm">
        Loading quiz…
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-teal-600 text-white p-6 gap-4">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => void loadQuiz()}
          className="underline font-medium"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-teal-600 p-6 text-center">
        <p className="text-white mb-4">
          No category found for slug <code className="bg-white/10 px-1 rounded">{CATEGORY_SLUG}</code>.
          Add a row in <code className="bg-white/10 px-1 rounded">skill_categories</code>.
        </p>
        <button
          type="button"
          onClick={() => router.push("/application/step-3-assessment")}
          className="text-white underline"
        >
          Back to categories
        </button>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-teal-600 p-6 text-center">
        <p className="text-white mb-4">
          No category found for slug <code className="bg-white/10 px-1 rounded">{CATEGORY_SLUG}</code>.
          Add a row in <code className="bg-white/10 px-1 rounded">skill_categories</code>.
        </p>
        <button
          type="button"
          onClick={() => router.push("/application/step-3-assessment")}
          className="text-white underline"
        >
          Back to categories
        </button>
      </div>
    )
  }

  return (
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageSrc="/images/skill-bg.jpg"
      rightPanelImageClassName="opacity-50 object-top"
      rightPanelOverlayClassName="bg-white/0"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper currentStep={3} completedThrough={2} />

        <div className="flex flex-1 flex-col pt-8">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-[24px] font-semibold leading-8 text-slate-800">
                {category.title}
              </h2>
              {category.description ? (
                <p className="text-[13px] text-slate-500 mt-2">
                  {category.description}
                </p>
              ) : (
                <p className="text-[13px] text-slate-500 mt-2">
                  Compassionate daily support and safe personal care practices.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => router.push("/application/step-4-documents")}
              className="cursor-pointer text-[12px] font-medium leading-5 text-[#0D9488] mt-1"
            >
              Skip for Now →
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-1">
            <p className="text-[13px] font-bold text-slate-800 w-full">Skills</p>
            <div className="flex gap-6 shrink-0 pr-1">
              {[1, 2, 3, 4].map((n) => (
                <span key={n} className="w-5 text-center text-[13px] font-semibold text-slate-600">
                  {n}
                </span>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {pageQuestions.map((q, i) => {
              const index = start + i
              return (
                <div key={q.id} className="flex items-center justify-between py-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0 pr-6">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#0D9488] text-[11px] font-semibold text-[#0D9488] mt-0.5">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-slate-800">{q.question}</p>
                      {q.description ? (
                        <p className="text-[11px] text-slate-400">{q.description}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-6 shrink-0 pr-1">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => selectAnswer(q.id, n)}
                        className={`h-5 w-5 rounded-full border-2 transition flex items-center justify-center ${
                          answers[q.id] === n
                            ? "border-[#0D9488] bg-[#0D9488]"
                            : "border-slate-300 bg-white hover:border-[#0D9488]"
                        }`}
                      >
                        {answers[q.id] === n && (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-auto flex items-center justify-between pt-6">
            <span className="text-[13px] font-medium text-slate-600">
              {page} of {totalPages}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={back}
                className="cursor-pointer rounded-md border border-[#0D9488] bg-white px-5 py-2 text-[12px] font-medium leading-5 text-[#0D9488] transition hover:bg-[#f0fffe]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void next()}
                disabled={saving}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#0D9488] px-6 py-2 text-[12px] font-medium leading-5 text-white transition hover:bg-[#0b7a70] disabled:opacity-50"
              >
                {saving ? "Saving..." : page >= totalPages ? "Submit" : "Save & Next"}
                {!saving && <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
