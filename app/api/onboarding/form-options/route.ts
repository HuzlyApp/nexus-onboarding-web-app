import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env"

export const runtime = "nodejs"

type OptionPayload = {
  states: string[]
  cities: string[]
  jobRoles: string[]
}

function normalize(v: unknown): string | null {
  if (typeof v !== "string") return null
  const trimmed = v.trim()
  return trimmed.length ? trimmed : null
}

function uniqueSorted(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort((a, b) =>
    a.localeCompare(b),
  )
}

export async function GET() {
  try {
    const url = getSupabaseUrl()
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    const anonKey = getSupabaseAnonKey()
    const key = serviceKey || anonKey

    if (!url || !key) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 })
    }

    const supabase = createClient(url, key)
    const { data, error } = await supabase
      .from("worker")
      .select("state, city, job_role")
      .order("created_at", { ascending: false })
      .limit(2000)

    if (error) throw error

    const rows = Array.isArray(data) ? data : []
    const payload: OptionPayload = {
      states: uniqueSorted(rows.map((r) => normalize((r as Record<string, unknown>).state))),
      cities: uniqueSorted(rows.map((r) => normalize((r as Record<string, unknown>).city))),
      jobRoles: uniqueSorted(rows.map((r) => normalize((r as Record<string, unknown>).job_role))),
    }

    return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load form options"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
