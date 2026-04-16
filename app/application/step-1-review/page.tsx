"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import OnboardingStepper from "@/app/components/OnboardingStepper"
import { Check } from "lucide-react"

export default function Step1Review() {
  const router = useRouter()

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
    email: "",
    jobRole: "",
    sameAsAddress1: false,
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)   // ← for popup

  // Load parsed resume data from PDF
  useEffect(() => {
    // Ensure we always have an applicant id for saving.
    const existingApplicantId = localStorage.getItem("applicantId")
    if (!existingApplicantId) {
      const newId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `app_${Date.now()}_${Math.random().toString(16).slice(2)}`
      localStorage.setItem("applicantId", newId)
    }

    const saved = localStorage.getItem("parsedResume")
    if (!saved) return

    try {
      const parsed = JSON.parse(saved)
      setForm({
        firstName: parsed.first_name || parsed.FirstName || "",
        lastName: parsed.last_name || parsed.LastName || "",
        address1: parsed.address1 || parsed.address || parsed.Address || "",
        address2: parsed.address2 || "",
        city: parsed.city || parsed.City || "",
        state: parsed.state || parsed.State || "",
        zipCode: parsed.zipCode || parsed.zip || "",
        phone: parsed.phone || parsed.Phone || "",
        email: parsed.email || parsed.Email || "",
        jobRole: parsed.job_role || parsed.JobRole || parsed.job_title || "",
        sameAsAddress1: false,
      })
    } catch (e) {
      console.error("Failed to parse resume data", e)
    }
  }, [])

  const handleChange = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function describeSaveError(err: unknown): string {
    if (err instanceof Error && err.message) return err.message
    if (err && typeof err === "object") {
      const e = err as { message?: string; details?: string; hint?: string; code?: string }
      const parts = [e.message, e.details, e.hint].filter((x): x is string => Boolean(x?.trim()))
      if (parts.length) return parts.join(" — ")
      if (e.code) return `Could not save (${e.code})`
    }
    return "Failed to save data"
  }

  const handleSaveAndContinue = async () => {
    setError(null)
    setLoading(true)

    try {
      const applicantId = localStorage.getItem("applicantId") || ""
      if (!applicantId) throw new Error("Missing applicant ID")

      const { error: upsertError } = await supabase
        .from("worker")
        .upsert({
          applicant_id: applicantId,
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          address1: form.address1.trim(),
          address2: form.address2.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          zip_code: form.zipCode.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          job_role: form.jobRole.trim(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "applicant_id" })
      // Create a new worker record on each save by generating a fresh applicantId.
      // This prevents overwriting the previous worker row keyed by user_id.
      // const applicantId = globalThis.crypto?.randomUUID?.()
      // if (!applicantId) throw new Error("Could not generate applicant ID")
      // localStorage.setItem("applicantId", applicantId)

      const payload = {
        applicantId,
        firstName: form.firstName,
        lastName: form.lastName,
        address1: form.address1,
        address2: form.address2,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode,
        phone: form.phone,
        email: form.email,
        jobRole: form.jobRole,
      }

      const workerRow = {
        user_id: applicantId,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        address1: form.address1.trim(),
        address2: form.address2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zipCode.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        job_role: form.jobRole.trim(),
        updated_at: new Date().toISOString(),
      }

      const saveRes = await fetch("/api/onboarding/save-worker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      let saveJson: { error?: string; hint?: string } = {}
      try {
        saveJson = (await saveRes.json()) as { error?: string; hint?: string }
      } catch {
        /* non-JSON error body */
      }

      if (
        saveRes.status === 503 &&
        (saveJson.error === "MISSING_SERVICE_ROLE_KEY" || saveJson.error === "MISSING_SUPABASE_URL")
      ) {
        const { supabaseBrowser: supabase } = await import("@/lib/supabase-browser")
        // Avoid upsert(..., onConflict: "user_id") in the browser — it requires a UNIQUE constraint on worker.user_id.
        // If the DB isn't migrated, upsert will either error or insert duplicates.
        const { data: existing, error: selErr } = await supabase
          .from("worker")
          .select("id")
          .eq("user_id", applicantId)
          .maybeSingle()
        if (selErr) {
          throw new Error(
            `${describeSaveError(selErr)} To save from the server instead, add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API → service_role secret).`
          )
        }
        if (existing?.id) {
          const { user_id: _u, ...updatePayload } = workerRow as Record<string, unknown>
          const { error: upErr } = await supabase.from("worker").update(updatePayload).eq("id", existing.id)
          if (upErr) {
            throw new Error(
              `${describeSaveError(upErr)} To save from the server instead, add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API → service_role secret).`
            )
          }
        } else {
          const { error: insErr } = await supabase.from("worker").insert(workerRow)
          if (insErr) {
            throw new Error(
              `${describeSaveError(insErr)} To save from the server instead, add SUPABASE_SERVICE_ROLE_KEY to .env.local (Supabase → Project Settings → API → service_role secret).`
            )
          }
        }
      } else if (!saveRes.ok) {
        throw new Error(
          saveJson.hint || saveJson.error || `Save failed (${saveRes.status})`
        )
      }

      const resumeStoragePath =
        typeof window !== "undefined"
          ? localStorage.getItem("resumeStoragePath")
          : null
      if (resumeStoragePath?.trim()) {
        try {
          const reqRes = await fetch("/api/onboarding/worker-requirements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              applicantId,
              resume_path: resumeStoragePath.trim(),
            }),
          })
          if (!reqRes.ok) {
            const j = (await reqRes.json().catch(() => ({}))) as { error?: string }
            console.warn(
              "[step-1-review] worker_requirements resume_path",
              j.error || reqRes.status
            )
          }
        } catch (e) {
          console.warn("[step-1-review] worker_requirements resume_path", e)
        }
      }

      // Save to localStorage for next steps (snake_case keys for steps that read parsedResume)
      localStorage.setItem(
        "parsedResume",
        JSON.stringify({
          first_name: form.firstName,
          last_name: form.lastName,
          address1: form.address1,
          address2: form.address2,
          city: form.city,
          state: form.state,
          zipCode: form.zipCode,
          phone: form.phone,
          email: form.email,
          job_role: form.jobRole,
          firstName: form.firstName,
          lastName: form.lastName,
          jobRole: form.jobRole,
        })
      )

      // Show success popup
      setSuccess(true)

      // Auto go to next page after showing popup
      setTimeout(() => {
        router.push("/application/step-2-license")
      }, 3000)

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save data"
      console.error(message, err)
      // setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1db4a3] flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row relative mx-auto w-full md:w-[1060px] md:max-w-[1060px] md:h-[944px] min-h-[600px] md:min-h-[650px]"
      >
        {/* LEFT - Form */}
        <div className="w-full md:w-[65%] p-6 md:p-10 flex flex-col justify-between">
          <div>
            <OnboardingStepper currentStep={1} />

            <h2 className="text-[22px] font-bold text-[#1e293b] mb-8 mt-6">
              Review resume details
            </h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
                {error}
              </div>
            )}

            <div className="space-y-5">
              {/* Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">First Name</label>
                  <div className="relative">
                    <input
                      value={form.firstName}
                      onChange={(e) => handleChange("firstName", e.target.value)}
                      className="w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm bg-white font-medium"
                      placeholder="First Name"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">Last Name</label>
                  <input
                    value={form.lastName}
                    onChange={(e) => handleChange("lastName", e.target.value)}
                    className="w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm bg-white"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              {/* Address 1 */}
              <div>
                <div className="flex justify-between">
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">Address 1</label>
                  <span className="text-[11px] text-gray-400 mt-0.5">Street Address, P.O Box</span>
                </div>
                <input
                  value={form.address1}
                  onChange={(e) => handleChange("address1", e.target.value)}
                  className="w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm bg-white"
                  placeholder="1234 Main St, Apt 4B"
                />
              </div>

              {/* Address 2 */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[13px] font-medium text-gray-600">Address 2</label>
                  <span className="text-[11px] text-gray-400">Apt, Suite, Building, Floor, etc...</span>
                </div>
                <input
                  value={form.address2}
                  onChange={(e) => handleChange("address2", e.target.value)}
                  disabled={form.sameAsAddress1}
                  className={`w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm
                    ${form.sameAsAddress1 ? "bg-gray-50 text-gray-500" : "bg-white"}`}
                  placeholder="Same as address 1"
                />
              </div>

              {/* City, State */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">City</label>
                  <div className="relative">
                    <select
                      value={form.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      className="w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm appearance-none bg-white font-medium"
                    >
                      <option value="Los Angeles">Los Angeles</option>
                      {/* Add more as needed */}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">State</label>
                  <div className="relative">
                    <select
                      value={form.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      className="w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm appearance-none bg-white font-medium"
                    >
                      <option value="California">California</option>
                      {/* Add more as needed */}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    className="w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm bg-white"
                    placeholder="+1-800-512-2366"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">Email</label>
                  <input
                    value={form.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className="w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm bg-white"
                    placeholder="rickashton@gmail.com"
                  />
                </div>
              </div>

              {/* Zip & Job Role */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">Zip Code</label>
                  <input
                    value={form.zipCode}
                    onChange={(e) => handleChange("zipCode", e.target.value)}
                    className="w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm bg-white"
                    placeholder="40170"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 mb-1.5">Job Role</label>
                  <div className="relative">
                    <select
                      value={form.jobRole}
                      onChange={(e) => handleChange("jobRole", e.target.value)}
                      className="w-full px-4 h-[56px] border border-gray-200 rounded-md focus:border-[#1db4a3] focus:outline-none text-[#1e293b] text-sm appearance-none bg-white font-medium"
                    >
                      <option value="">CNA</option>
                      <option value="RN">RN</option>
                      <option value="LVN">LVN</option>
                      <option value="Medical Assistant">Medical Assistant</option>
                      <option value="Caregiver">Caregiver</option>
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-10">
            <button
              onClick={() => router.back()}
              className="cursor-pointer px-6 py-2.5 border border-[#1db4a3] text-[#1db4a3] text-sm font-medium rounded-lg hover:bg-teal-50 transition"
            >
              Back
            </button>
            <button
              onClick={handleSaveAndContinue}
              disabled={loading}
              className="cursor-pointer px-6 py-2.5 bg-[#1db4a3] hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? "Saving..." : "Save & continue"}
            </button>
          </div>
        </div>

        {/* RIGHT - Branding and Image */}
        <div className="hidden md:block w-[35%] relative bg-gray-50">
          <div className="absolute inset-0 z-0">
            {/* You'll need to make sure the image path matches what you have or I can generate a placeholder */}
            <Image
              src="/images/nurse.jpg"
              alt="Healthcare professional smiling"
              fill
              className="object-cover object-top opacity-50 grayscale"
              priority
            />
            {/* Gradient overlay to match the original soft fade */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/40 to-white"></div>
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-10">
            <div className="mb-6">
              <Image
                src="/images/new-logo-nexus.svg"
                alt="Nexus MedPro Logo"
                width={204}
                height={60}
                priority
              />
            </div>

            <div className="w-full max-w-[280px]">
              <div className="w-full h-[1px] bg-gray-300 relative mb-6">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-1 flex items-center justify-center]">
                  {/* <div className="w-[10px] h-[10px] bg-[#1cb5a3] rounded-full"></div> */}
                  <Image
                    src="/icons/circle-star-icon.svg"
                    alt=""
                    width={24}
                    height={24}
                    className="h-6 w-6 flex-none"
                  />
                </div>
              </div>
              <p
                className="text-[#1e293b]"
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '16px',
                  lineHeight: '24px',
                  textAlign: 'center',
                }}
              >
                Nexus MedPro Staffing <span className="mx-0.5">–</span> Connecting Healthcare professionals with service providers
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SUCCESS POPUP */}
      {success && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] animate-in fade-in duration-300">
          <div
            className="bg-white rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.2)] flex flex-col items-center justify-center text-center p-6 md:p-10 transform animate-in zoom-in-95 duration-300 w-[95%] max-w-[520px] min-h-[380px] md:h-[400px] mx-4"
          >
            <div className="flex h-[72px] w-[72px] mb-6 items-center justify-center rounded-full bg-[#28c7bf] text-white shadow-sm flex-none">
              <Check className="h-8 w-8" strokeWidth={2.5} />
            </div>
            {/* <div className="mb-8">
              <div className="w-[84px] h-[84px] bg-[#00C440] rounded-xl flex items-center justify-center shadow-[0_8px_16px_rgba(0,196,64,0.25)]">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div> */}

            <h3 className="text-[28px] md:text-[32px] font-bold text-slate-900 mb-3 tracking-tight">
              Saved Successfully!
            </h3>

            <p className="text-[16px] md:text-[18px] text-slate-600 mb-8 md:mb-10 max-w-[340px] leading-relaxed">
              Your information has been saved.
            </p>

            <button
              onClick={() => router.push("/application/step-2-license")}
              className="cursor-pointer w-full max-w-[360px] h-14 bg-[#28C7BF] hover:bg-[#23B5AD] text-white text-[18px] font-bold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Continue to Next Step
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

