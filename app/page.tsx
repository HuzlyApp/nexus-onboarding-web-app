"use client"

import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#19c7c0_0%,#10a58f_100%)] p-4 sm:p-6 lg:p-8">
      <section className="w-full overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)] md:h-[600px] md:w-[1060px] md:grid md:grid-cols-[620px_440px]">
        <div className="flex min-h-[550px] flex-col items-center justify-center gap-9 px-8 py-10 text-center sm:px-10 md:h-[600px] md:px-10 md:py-10">
          <div className="space-y-3">
            <h1 className="text-[34px] font-semibold leading-[48px] tracking-normal text-slate-800 sm:text-[42px] md:text-[48px]">
              Join Nexus Medpro
            </h1>
            <p className="text-[16px] font-normal leading-6 tracking-normal text-slate-500">
              Quick pay, flexible shifts, support team
            </p>
          </div>

          <button
            onClick={() => router.push("/application/step-1-upload")}
            className="inline-flex min-h-14 min-w-[210px] cursor-pointer items-center justify-center rounded-xl bg-teal-600 px-8 py-4 text-[22px] font-semibold leading-[22px] text-white shadow-[0_10px_20px_rgba(13,148,136,0.22)] transition hover:bg-teal-700 focus:outline-none focus:ring-4"
          >
            Start Application
          </button>

          <p className="text-center text-[14px] font-normal leading-5 tracking-normal text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[14px] font-semibold leading-5 tracking-normal text-[#0D9488] transition hover:text-teal-700"
            >
              Sign In
            </Link>
          </p>
        </div>
 <div className="relative flex min-h-[430px] items-center justify-center overflow-hidden border-t border-slate-200 md:h-[600px] md:w-[440px] md:border-l md:border-t-0">
          {/* Background photo */}
          <Image
            src="/images/handshake.jpg"
            alt="Nexus MedPro staffing"
            fill
            className="object-cover grayscale"
            priority
          />
          {/* White overlay */}
          <div className="absolute inset-0 bg-white/75" />

          {/* Content */}
          <div className="relative z-10 flex w-full flex-col items-center justify-center gap-5 px-8 text-center md:px-12">
            {/* Logo */}
            <div className="relative h-[80.22px] w-[270px]">
              <Image
                src="/images/new-logo-nexus.svg"
                alt="Nexus MedPro Logo"
                fill
                className="object-contain"
                priority
              />
            </div>

            {/* Divider with asterisk */}
            <div className="flex w-full max-w-[340px] items-center justify-center gap-4">
              <div className="h-px flex-1 bg-slate-400/40" />
              <div className="flex h-7 w-7 items-center justify-center">
                <Image
                  src="/images/tabler_circle-asterisk.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="flex-none"
                />
              </div>
              <div className="h-px flex-1 bg-slate-400/40" />
            </div>

            {/* Tagline */}
            <p className="max-w-[300px] text-center text-[15px] font-normal leading-6 tracking-normal text-black">
              Nexus MedPro Staffing – Connecting Healthcare professionals with
              service providers
            </p>
          </div>
        </div>

       
      </section>
    </main>
  )
}
