"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { supabaseBrowser as supabase } from "@/lib/supabase-browser"
import { MOBILITY_CATEGORY_ID } from "@/lib/mobility-category"

/** `skill_assessments.worker_id` = auth user id; `category` matches `skill_categories.slug` */
const CATEGORY_SLUG = "mobility"
const PAGE_SIZE = 5

type QuestionRow = {
  id: string
  question: string
  description?: string | null
  quiz_number: number | null
}

type CategoryRow = {
  id: string
  title: string
  description: string | null
}

function normalizeAnswers(
  raw: unknown,
  questions: QuestionRow[]
): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const out: Record<string, number> = {}
  const keys = Object.keys(o)
  const uuidLike =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
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

export default function MobilityQuiz() {
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
        .eq("id", MOBILITY_CATEGORY_ID)
        .maybeSingle()

      if (cErr) throw cErr
      if (!cat) {
        setCategory(null)
        setQuestions([])
        setLoading(false)
        return
      }

      setCategory(cat as CategoryRow)

      const { data: qs, error: qErr } = await supabase
        .from("skill_questions")
        .select("id, question, quiz_number")
        .eq("category_id", cat.id)
        .order("quiz_number", { ascending: true, nullsFirst: false })

      if (qErr) throw qErr
      const ordered = (qs ?? []) as QuestionRow[]
      setQuestions(ordered)

      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        setLoading(false)
        return
      }

      const { data: worker } = await supabase
        .from("worker")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()
      const workerId = worker?.id ? String(worker.id) : user.id

      const { data: row } = await supabase
        .from("skill_assessments")
        .select("answers")
        .eq("worker_id", workerId)
        .eq("category", CATEGORY_SLUG)
        .maybeSingle()

      setAnswers(normalizeAnswers(row?.answers ?? null, ordered))
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
      console.error("[mobility quiz]", e)
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
    const { data: worker, error: wErr } = await supabase
      .from("worker")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (wErr || !worker?.id) {
      alert("Worker profile not found. Please complete Step 1 first.")
      return false
    }
    const workerId = String(worker.id)
    const cleanAnswers = JSON.parse(JSON.stringify(answers)) as Record<string, number>

    const { data: existing, error: findErr } = await supabase
      .from("skill_assessments")
      .select("id")
      .eq("worker_id", workerId)
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
        worker_id: workerId,
        category: CATEGORY_SLUG,
        answers: cleanAnswers,
        completed,
      })

      if (insErr) {
        console.error(insErr)
        const e = insErr as { code?: string; message?: string }
        if (e.code === "23505" && (e.message || "").includes("skill_assessments_worker_id_key")) {
          alert(
            'Database constraint is still UNIQUE(worker_id). Apply the migration that replaces it with UNIQUE(worker_id, category) (see supabase/migrations/20260410194500_create_skill_assessments.sql), then try again.'
          )
        } else {
          alert(insErr.message)
        }
        return false
      }
    }

    if (completed) {
      localStorage.setItem("mobility_done", "true")
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
          No category found with id{" "}
          <code className="bg-white/10 px-1 rounded">{MOBILITY_CATEGORY_ID}</code>. Add or fix the Mobility
          row in <code className="bg-white/10 px-1 rounded">skill_categories</code> (slug{" "}
          <code className="bg-white/10 px-1 rounded">{CATEGORY_SLUG}</code>).
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
    <div className="min-h-screen bg-teal-600 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-[1100px] bg-white rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 p-6 md:p-10 min-w-0">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{category.title}</h2>

          {category.description ? (
            <p className="text-gray-600 text-sm mb-2">{category.description}</p>
          ) : null}

          <p className="text-gray-800 mb-6">Answer the following questions</p>

          {questions.length === 0 ? (
            <p className="text-sm text-gray-600 mb-8">
              No questions in <code className="bg-gray-100 px-1 rounded">skill_questions</code> for this
              category. Add rows linked to this category&apos;s id (Mobility uses the same schema as Basic
              Care).
            </p>
          ) : (
            <div className="space-y-6">
              {pageQuestions.map((q, i) => {
                const globalIndex = start + i
                return (
                  <div
                    key={q.id}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-gray-100 pb-4"
                  >
                    <div className="text-gray-900 min-w-0">
                      <span className="font-medium">{globalIndex + 1}.</span> {q.question}
                      {q.description ? (
                        <p className="text-sm text-gray-500 mt-1">{q.description}</p>
                      ) : null}
                    </div>

                    <div className="flex gap-6 shrink-0 justify-end">
                      {[1, 2, 3, 4].map((n) => (
                        <button
                          key={n}
                          type="button"
                          aria-label={`Rating ${n}`}
                          onClick={() => selectAnswer(q.id, n)}
                          className={`w-5 h-5 rounded-full border cursor-pointer transition-colors ${
                            answers[q.id] === n
                              ? "bg-teal-600 border-teal-600"
                              : "border-gray-400 hover:border-teal-400"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mt-10">
            <span className="text-gray-700 text-sm">
              {questions.length === 0 ? "—" : `${page} of ${totalPages}`}
            </span>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={back}
                className="px-5 py-2 border-2 border-gray-300 rounded-md text-gray-800 hover:bg-gray-50"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => void next()}
                disabled={saving || questions.length === 0}
                className="px-6 py-2 bg-teal-600 text-white rounded-md disabled:opacity-50 hover:bg-teal-700"
              >
                {saving
                  ? "Saving…"
                  : questions.length === 0
                    ? "Continue"
                    : page >= totalPages
                      ? "Submit"
                      : "Next"}
              </button>
            </div>
          </div>
        </div>

        <div className="w-full md:w-[350px] bg-gray-100 flex flex-col items-center justify-center p-8 md:min-h-[420px] relative">
          <Image
            src="/images/nexus-logo.png"
            alt="Nexus MedPro Staffing"
            width={160}
            height={56}
            className="mb-4 h-auto w-40"
          />
          <p className="text-gray-800 text-center text-sm px-4">
            Nexus MedPro Staffing – Connecting Healthcare professionals with service providers
          </p>
        </div>
      </div>
    </div>
  )
}