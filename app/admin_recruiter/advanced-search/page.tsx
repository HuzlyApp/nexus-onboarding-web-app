"use client"

import { useEffect, useMemo, useState } from "react"
import MapBoxAdvanced from "@/app/components/MapboxAdvanced"
import Link from "next/link"

// ✅ TYPE
type Worker = {
  id: string
  first_name: string
  last_name: string
  lat: number
  lng: number
  job_role: string
  city?: string | null
  state?: string | null
  distance_meters?: number | null
}

type MapboxFeature = {
  place_name: string
  center: [number, number]
}

function parseMapboxFeature(input: unknown): MapboxFeature | null {
  if (input == null || typeof input !== "object") return null
  const r = input as Record<string, unknown>
  const place_name = r.place_name
  const center = r.center
  if (typeof place_name !== "string") return null
  if (!Array.isArray(center) || center.length < 2) return null
  const lng = Number(center[0])
  const lat = Number(center[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return { place_name, center: [lng, lat] }
}

function toMessage(err: unknown) {
  if (err instanceof Error) return err.message
  return "Failed to fetch workers"
}

function parseWorker(input: unknown): Worker | null {
  if (input == null || typeof input !== "object") return null
  const r = input as Record<string, unknown>
  const id = r.id
  const first_name = r.first_name
  const last_name = r.last_name
  const job_role = r.job_role
  const lat = Number(r.lat)
  const lng = Number(r.lng)
  if (typeof id !== "string") return null
  if (typeof first_name !== "string") return null
  if (typeof last_name !== "string") return null
  if (typeof job_role !== "string") return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    id,
    first_name,
    last_name,
    job_role,
    lat,
    lng,
    city: typeof r.city === "string" ? r.city : r.city === null ? null : undefined,
    state: typeof r.state === "string" ? r.state : r.state === null ? null : undefined,
    distance_meters: typeof r.distance_meters === "number" ? r.distance_meters : null,
  }
}

function normalizeWorkersResponse(data: unknown): Worker[] {
  const arr = Array.isArray(data)
    ? data
    : Array.isArray((data as { workers?: unknown })?.workers)
      ? (((data as { workers: unknown[] }).workers ?? []) as unknown[])
      : []

  return arr.map(parseWorker).filter((w): w is Worker => w !== null)
}

export default function AdvancedSearchPage() {

  // ✅ STATE
  const [workers, setWorkers] = useState<Worker[]>([])
  const [center, setCenter] = useState<[number, number]>([121.0437, 14.6760])
  const [radiusMiles, setRadiusMiles] = useState<number>(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)

  const [placeQuery, setPlaceQuery] = useState("")
  const [placeLabel, setPlaceLabel] = useState("")
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([])

  // ✅ AUTO GPS
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.longitude, pos.coords.latitude])
      },
      () => {
        console.log("GPS denied")
      }
    )
  }, [])

  // Mapbox suggestions
  useEffect(() => {
    let cancelled = false
    async function run() {
      const q = placeQuery.trim()
      if (q.length < 3) {
        setSuggestions([])
        return
      }
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
        if (!token) return
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            q
          )}.json?access_token=${encodeURIComponent(token)}&autocomplete=true&limit=5`
        )
        const data = await res.json()
        if (cancelled) return
        const features: unknown[] = Array.isArray((data as { features?: unknown })?.features)
          ? ((data as { features: unknown[] }).features ?? [])
          : []
        const feats: MapboxFeature[] = features
          .map(parseMapboxFeature)
          .filter((v): v is MapboxFeature => v !== null)
        setSuggestions(feats)
      } catch {
        if (!cancelled) setSuggestions([])
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [placeQuery])

  // ✅ FETCH WORKERS
  async function searchWorkers() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/search-workers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: center[1],
          lng: center[0],
          radius: radiusMiles,
          ...(placeLabel.trim() ? { place: placeLabel.trim() } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Failed to fetch workers")
      setWorkers(normalizeWorkersResponse(data))

    } catch (err) {
      setError(toMessage(err))
    }

    setLoading(false)
  }

  function reset() {
    setRadiusMiles(10)
    setWorkers([])
    setError(null)
    setPlaceQuery("")
    setPlaceLabel("")
    setSuggestions([])
  }

  const resultsHref = useMemo(() => {
    const sp = new URLSearchParams()
    sp.set("lat", String(center[1]))
    sp.set("lng", String(center[0]))
    sp.set("radius", String(radiusMiles))
    if (placeLabel) sp.set("place", placeLabel)
    return `/admin_recruiter/advanced-search/results?${sp.toString()}`
  }, [center, radiusMiles, placeLabel])

  return (
    <div className="relative min-h-screen bg-zinc-50">
      {/* overlay modal like screenshot */}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6">
          <div className="w-full max-w-3xl rounded-3xl bg-white border border-zinc-200 shadow-xl overflow-hidden text-gray-600">
            <div className="p-6 flex items-center justify-between">
              <div className="text-lg font-semibold">Advanced Search</div>
              <button
                onClick={() => setOpen(false)}
                className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="px-6 pb-6">
              <div className="h-[260px] rounded-2xl overflow-hidden border border-zinc-200">
                <MapBoxAdvanced
                  center={center}
                  workers={workers}
                  radius={radiusMiles}
                  onCenterChange={(c) => setCenter(c)}
                  interactive
                  onMapError={(msg) => {
                    // Most common: "Invalid API key" / "Invalid access token"
                    setMapError(msg)
                  }}
                />
              </div>

              <div className="mt-4 grid grid-cols-12 gap-3 items-end">
                <div className="col-span-12 sm:col-span-4">
                  <div className="text-xs text-gray-600 mb-1">Show me worker within</div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={radiusMiles}
                      min={1}
                      onChange={(e) => setRadiusMiles(Number(e.target.value))}
                      className="w-full border border-zinc-200 rounded-2xl px-4 py-3 text-sm"
                    />
                    <div className="border border-zinc-200 rounded-2xl px-4 py-3 text-sm bg-white">
                      Miles
                    </div>
                  </div>
                </div>

                <div className="col-span-12 sm:col-span-8">
                  <div className="text-xs text-gray-600 mb-1">of</div>
                  <div className="relative">
                    <input
                      value={placeQuery}
                      onChange={(e) => setPlaceQuery(e.target.value)}
                      placeholder="Search city or address"
                      className="w-full border border-zinc-200 rounded-2xl px-4 py-3 text-sm"
                    />
                    {suggestions.length > 0 ? (
                      <div className="absolute top-full mt-2 w-full rounded-2xl border border-zinc-200 bg-white shadow-lg overflow-hidden z-10">
                        {suggestions.map((s) => (
                          <button
                            key={s.place_name}
                            onClick={() => {
                              setPlaceLabel(s.place_name)
                              setPlaceQuery(s.place_name)
                              setSuggestions([])
                              setCenter([s.center[0], s.center[1]])
                            }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-50"
                          >
                            {s.place_name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  onClick={reset}
                  className="border border-zinc-200 rounded-2xl px-4 py-3 text-sm hover:bg-zinc-50"
                >
                  Reset
                </button>
                <button
                  onClick={searchWorkers}
                  className="bg-teal-700 hover:bg-teal-800 text-white rounded-2xl px-4 py-3 text-sm"
                >
                  {loading ? "Searching…" : "Search"}
                </button>
              </div>

              <div className="mt-4 text-center text-sm">
                Total: <span className="font-medium">{workers.length}</span> Results{" "}
                {placeLabel ? <>found in <span className="font-medium">{placeLabel}</span></> : null}
              </div>

              <div className="mt-4">
                <Link
                  href={resultsHref}
                  className="w-full inline-flex items-center justify-center bg-teal-700 hover:bg-teal-800 text-white rounded-2xl px-4 py-3 text-sm"
                >
                  View results
                </Link>
              </div>

              {mapError ? (
                <div className="mt-3 text-sm text-red-600">
                  {mapError.includes("Invalid") || mapError.toLowerCase().includes("token")
                    ? "Invalid Mapbox API key. Set a valid NEXT_PUBLIC_MAPBOX_TOKEN in .env.local and restart the dev server."
                    : mapError}
                </div>
              ) : null}
              {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Page fallback background */}
      <div className="p-8 text-gray-600">
        <div className="text-xs text-gray-600 mb-2">Admin - Advanced Search</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-semibold">Candidates</div>
            <div className="text-sm">Manage applicants in one place</div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="bg-teal-700 hover:bg-teal-800 text-white rounded-2xl px-5 py-3 text-sm"
          >
            Open advanced search
          </button>
        </div>
      </div>
    </div>
  )
}