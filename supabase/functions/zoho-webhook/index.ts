import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "*",
}

function getNotificationBlock(body: Record<string, unknown>) {
  const n = body.notifications
  if (Array.isArray(n) && n.length > 0) return n[0] as Record<string, unknown>
  if (n && typeof n === "object") return n as Record<string, unknown>
  return null
}

function isRequestCompleted(body: Record<string, unknown>): boolean {
  const n = getNotificationBlock(body)
  const op =
    (typeof n?.operation_type === "string" && n.operation_type) ||
    (typeof n?.event_type === "string" && n.event_type) ||
    (typeof body.event_type === "string" && body.event_type)

  if (!op) return false
  const normalized = op.toLowerCase().replace(/\./g, "_")
  return op === "RequestCompleted" || op === "request.completed" || normalized === "request_completed"
}

function getRequestId(body: Record<string, unknown>): string | null {
  const r = body.requests as Record<string, unknown> | undefined
  if (r && typeof r.request_id === "string" && r.request_id.trim()) {
    return r.request_id.trim()
  }
  if (typeof body.request_id === "string" && body.request_id.trim()) {
    return body.request_id.trim()
  }
  return null
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const webhookSecret = Deno.env.get("ZOHO_WEBHOOK_SECRET")?.trim()
  if (webhookSecret) {
    const provided = req.headers.get("x-zoho-webhook-secret") || req.headers.get("x-webhook-secret") || ""
    if (provided !== webhookSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
  }

  const raw = await req.text()
  let body: Record<string, unknown> = {}
  try {
    body = JSON.parse(raw || "{}") as Record<string, unknown>
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  if (!isRequestCompleted(body)) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const requestId = getRequestId(body)
  if (!requestId) {
    return new Response(JSON.stringify({ ok: true, ignored: true, reason: "no request_id" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const supabase = createClient(supabaseUrl, serviceKey)

  const { error } = await supabase.from("agreements").update({ status: "signed" }).eq("request_id", requestId)

  if (error) {
    console.error("[zoho-webhook] update failed:", error)
    return new Response(JSON.stringify({ error: "Database update failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
})

