"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { CheckCircle2 } from "lucide-react"

export default function SuccessPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#27c8c0_0%,#16a79a_100%)] flex items-center justify-center p-6 md:p-12">
      <div className="w-full max-w-[840px] min-h-[500px] h-[500px] overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_rgba(0,0,0,0.18)]">
        <div className="flex h-full">
          <div className="w-full md:w-[510px] flex flex-col items-center justify-center px-10 pb-10 pt-[56px] text-center">
            <div className="space-y-6 max-w-[420px] mx-auto">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#dcf6ed] text-[#0D9488] shadow-sm">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-[32px] font-semibold text-slate-900 tracking-[-0.03em]">
                  Application Received
                </h1>
                <p className="mt-4 text-[15px] leading-7 text-slate-600">
                  We’ll contact you within 1–3 business days.
                  <br />
                  Please check your email for the latest update.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard/application-status")}
              className="mt-10 inline-flex items-center justify-center rounded-xl bg-[#0D9488] px-8 py-3 text-[14px] font-semibold text-white transition hover:bg-[#0b7a70]"
            >
              Check Status
            </button>
          </div>

          <div className="relative hidden md:block w-[330px] overflow-hidden">
            <Image
              src="/images/success.jpg"
              alt="Nurse background"
              fill
              className="object-cover opacity-50"
              priority
            />
            <div className="absolute inset-0 bg-white/70" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-5 text-center">
              <div className="relative h-16 w-44">
                <Image
                  src="/images/new-logo-nexus.svg"
                  alt="Nexus MedPro Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <div className="flex w-full items-center justify-center gap-3">
                <div className="h-px flex-1 bg-slate-300/70" />
                <div className="rounded-full border border-slate-300/70 bg-white p-2 shadow-sm">
                  <Image
                    src="/icons/circle-star-icon.svg"
                    alt="Star icon"
                    width={20}
                    height={20}
                    className="object-contain"
                  />
                </div>
                <div className="h-px flex-1 bg-slate-300/70" />
              </div>
              <p className="max-w-[240px] text-[14px] leading-6 text-slate-700">
                Nexus MedPro Staffing – Connecting Healthcare professionals with service providers
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}