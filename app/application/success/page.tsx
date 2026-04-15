// app/application/success/page.tsx
"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { CheckCircle2 } from "lucide-react"

export default function SuccessPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-r from-teal-400 to-emerald-500 flex items-center justify-center p-6 md:p-12">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Green top bar */}
        <div className="h-2 bg-gradient-to-r from-teal-500 to-emerald-600" />

        <div className="p-10 md:p-16 text-center">
          {/* Checkmark */}
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-16 w-16 text-emerald-600" />
          </div>

          {/* Heading */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Application Received
          </h1>

          {/* Message */}
          <p className="text-lg md:text-xl text-gray-700 leading-relaxed mb-10">
            Well contact you within 1-3 business days.
            <br />
            Please check your email for the latest update.
          </p>

          {/* Branding */}
          <div className="flex flex-col items-center gap-4 mb-12">
            <Image
              src="/images/nexus-logo.png"
              alt="Nexus MedPro Logo"
              width={180}
              height={60}
              className="h-12 w-auto"
            />
            <p className="text-gray-600 font-medium text-center max-w-md">
              Nexus MedPro Staffing – Connecting Healthcare professionals with service providers
            </p>
          </div>

          {/* Check Status Button */}
          <button
            onClick={() => router.push("/dashboard/application-status")} // ← change to your status page
            className="px-10 py-4 bg-teal-600 text-white font-semibold text-lg rounded-xl hover:bg-teal-700 transition shadow-md focus:outline-none focus:ring-4 focus:ring-teal-300"
          >
            Check Status
          </button>
        </div>
      </div>
    </div>
  )
}