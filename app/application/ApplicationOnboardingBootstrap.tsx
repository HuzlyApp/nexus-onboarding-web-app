"use client"

import { useEffect, useState } from "react"

/**
 * Runs before onboarding pages mount so `worker.user_id` FK to `auth.users` is satisfied.
 */
export default function ApplicationOnboardingBootstrap({
  children,
}: {
  children: React.ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { supabaseBrowser } = await import("@/lib/supabase-browser")
        const { ensureApplicantMatchesAuthSession } = await import(
          "@/lib/onboarding/ensure-applicant-auth"
        )
        const r = await ensureApplicantMatchesAuthSession(supabaseBrowser)
        if (!alive) return
        if ("error" in r) setError(r.error)
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : "Could not start applicant session.")
      } finally {
        if (alive) setReady(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-600">
        Starting secure session…
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-sm text-red-700">
        <p className="font-medium">Could not start onboarding session</p>
        <p className="mt-2 text-gray-700">{error}</p>
        <p className="mt-4 text-xs text-gray-500">
          In Supabase Dashboard, enable Anonymous Sign-In (Authentication → Providers). Then refresh this
          page.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
