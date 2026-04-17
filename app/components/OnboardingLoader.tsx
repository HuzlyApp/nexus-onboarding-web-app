"use client"

type OnboardingLoaderProps = {
  label?: string
}

export default function OnboardingLoader({
  label = "Loading, please wait...",
}: OnboardingLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(135deg,#27c8c0_0%,#16a79a_100%)] p-6">
      <div className="flex min-w-[260px] flex-col items-center gap-4 rounded-2xl bg-white/95 px-8 py-7 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
        <div className="h-11 w-11 animate-spin rounded-full border-4 border-[#99f6e4] border-t-[#0D9488]" />
        <p className="text-center text-[15px] font-semibold leading-6 text-slate-800">
          {label}
        </p>
      </div>
    </div>
  )
}
