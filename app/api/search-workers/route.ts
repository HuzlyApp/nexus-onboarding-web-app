import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { requireStaffApiSession } from "@/lib/auth/api-session"
import { getSupabaseUrl } from "@/lib/supabase-env"

type RpcRow = Record<string, unknown>

function mergeById(a: RpcRow[], b: RpcRow[]): RpcRow[] {
  const map = new Map<string, RpcRow>()
  for (const r of a) {
    const id = r.id != null ? String(r.id) : ""
    if (id) map.set(id, { ...r })
  }
  for (const r of b) {
    const id = r.id != null ? String(r.id) : ""
    if (!id) continue
    if (!map.has(id)) map.set(id, { ...r })
  }
  return [...map.values()]
}

/** Map plain worker rows to the shape the map / results table expect. */
function mapWorkerRow(
  w: Record<string, unknown>,
  opts: { lat: number; lng: number }
): RpcRow {
  const lat = typeof w.lat === "number" ? w.lat : typeof w.latitude === "number" ? w.latitude : opts.lat
  const lng = typeof w.lng === "number" ? w.lng : typeof w.longitude === "number" ? w.longitude : opts.lng
  return {
    id: w.id,
    first_name: w.first_name ?? "",
    last_name: w.last_name ?? "",
    job_role: w.job_role ?? "",
    city: w.city ?? null,
    state: w.state ?? null,
    address1: w.address1 ?? null,
    address: (w.address1 as string) || (w.address as string) || null,
    lat,
    lng,
    distance_meters: null,
  }
}

export async function POST(req: Request) {
  const auth = await requireStaffApiSession()
  if (auth instanceof NextResponse) return auth

  const url = getSupabaseUrl()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return Response.json({ error: "Supabase is not configured" }, { status: 503 })
  }

  const supabase = createClient(url, key)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const lat = typeof b.lat === "number" ? b.lat : Number(b.lat)
  const lng = typeof b.lng === "number" ? b.lng : Number(b.lng)
  const radius = typeof b.radius === "number" ? b.radius : Number(b.radius)
  const place = typeof b.place === "string" ? b.place.trim() : ""

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radius) || radius <= 0) {
    return Response.json({ error: "Invalid lat/lng/radius" }, { status: 400 })
  }

  let rpcRows: RpcRow[] = []
  const { data: rpcData, error: rpcError } = await supabase.rpc("nearby_workers", {
    lat,
    lng,
    radius_meters: radius * 1609.344, // miles → meters
  })

  if (rpcError) {
    // RPC may be missing in dev — still allow city search
    if (!place) {
      return Response.json({ error: rpcError.message }, { status: 500 })
    }
  } else if (Array.isArray(rpcData)) {
    rpcRows = rpcData as RpcRow[]
  }

  let cityRows: RpcRow[] = []
  if (place) {
    // Match worker.city / state / address1 (free text often lives in address1)
    const segment = place.split(",")[0]?.trim() || place
    const term = segment.slice(0, 120)
    // Keep PostgREST `or()` values simple: no commas / wildcards in the literal
    const safe = term.replace(/[^\p{L}\p{N}\s\-]/gu, " ").replace(/\s+/g, " ").trim()
    if (safe.length >= 2) {
      const pattern = `%${safe}%`

      const { data: wk, error: wErr } = await supabase
        .from("worker")
        .select("id, first_name, last_name, job_role, city, state, address1")
        .or(`city.ilike.${pattern},state.ilike.${pattern},address1.ilike.${pattern}`)

      if (wErr) {
        return Response.json({ error: wErr.message }, { status: 500 })
      }

      cityRows = (wk ?? []).map((row) => mapWorkerRow(row as Record<string, unknown>, { lat, lng }))
    }
  }

  const merged = mergeById(rpcRows, cityRows)
  return Response.json(merged)
}