"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import OnboardingLayout from "@/app/components/OnboardingLayout"
import OnboardingStepper from "@/app/components/OnboardingStepper"

export default function ReferencesPage() {
  const router = useRouter()

  const [refs, setRefs] = useState([{ first: "", last: "", phone: "", email: "" }])
  const [error, setError] = useState("")

  function update(index: number, field: string, value: string) {
    const updated = [...refs]
    updated[index] = { ...updated[index], [field]: value }
    setRefs(updated)
  }

  function addReference() {
    if (refs.length >= 3) return
    setRefs([...refs, { first: "", last: "", phone: "", email: "" }])
  }

  function hasDuplicateNames() {
    const names = refs
      .map((r) => `${r.first}-${r.last}`.toLowerCase())
      .filter((n) => n !== "-")
    return new Set(names).size !== names.length
  }

  async function saveReferences() {
    setError("")
    if (hasDuplicateNames()) { setError("Duplicate reference names are not allowed."); return }
    for (const r of refs) {
      if (!r.first || !r.last || !r.phone || !r.email) {
        setError("Please fill all required fields.")
        return
      }
    }
    const { error } = await supabase.from("worker_references").insert(
      refs.map((r) => ({ first_name: r.first, last_name: r.last, phone: r.phone, email: r.email }))
    )
    if (error) { setError(error.message); return }
    // router.push("/application/step-6-summary")
     localStorage.setItem("referenceData", JSON.stringify(refs))
    localStorage.setItem("referencesCount", String(refs.length))

    router.push("/application/step-5-reference-review")
  }

  return (
    <OnboardingLayout
      cardClassName="md:h-auto md:min-h-[700px]"
      rightPanelImageSrc="/images/main-doctor.jpg"
       rightPanelImageClassName="opacity-50 object-top"
      rightPanelOverlayClassName="bg-white/50"
    >
      <div className="flex h-full flex-col px-10 pb-10 pt-8">
        <OnboardingStepper currentStep={5} completedThrough={4} />

        <div className="flex flex-1 flex-col pt-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <h2 className="text-[24px] font-semibold leading-8 text-slate-800">Add References</h2>
            <button
              type="button"
              onClick={() => router.push("/application/step-5-reference-review")}
              className="cursor-pointer text-[12px] font-medium leading-5 text-[#0D9488] mt-1"
            >
              Skip for Now →
            </button>
          </div>
          <p className="text-[13px] text-slate-500 mb-1">Trusted feedback, verified integrity.</p>
          <p className="text-[12px] text-slate-400 mb-6">
            Note: You can add up to 3 references. Just click the add reference button.
          </p>

          {/* References */}
          <div className="space-y-8">
            {refs.map((r, index) => (
              <div key={index}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[15px] font-bold text-slate-800">Reference {index + 1}</p>
                  {index === 2 && <p className="text-[11px] text-slate-400">Optional</p>}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">First Name</label>
                    <input
                      value={r.first}
                      onChange={(e) => update(index, "first", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#0D9488] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Last Name</label>
                    <input
                      value={r.last}
                      onChange={(e) => update(index, "last", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#0D9488] transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Phone</label>
                    <input
                      value={r.phone}
                      onChange={(e) => update(index, "phone", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#0D9488] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Email</label>
                    <input
                      value={r.email}
                      onChange={(e) => update(index, "email", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-[#0D9488] transition"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Reference button */}
          {refs.length < 3 && (
            <button
              type="button"
              onClick={addReference}
              className="mt-6 w-fit rounded-md border border-[#0D9488] px-4 py-1.5 text-[12px] font-medium text-[#0D9488] transition hover:bg-[#f0fffe]"
            >
              + Add Reference
            </button>
          )}

          {error && <p className="mt-4 text-[12px] text-red-500">{error}</p>}

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
              onClick={saveReferences}
              className="cursor-pointer rounded-md bg-[#0D9488] px-6 py-2 text-[12px] font-medium leading-5 text-white transition hover:bg-[#0b7a70]"
            >
              Save &amp; continue
            </button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  )
}
