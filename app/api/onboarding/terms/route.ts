import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase-env"

export const runtime = "nodejs"

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
      .from("terms_sections")
      .select("id, title, content, sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (error) throw error

    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load terms"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
