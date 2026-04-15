import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { text } = await req.json()

  const prompt = `
Extract resume data and return ONLY JSON:

{
  "firstName": "",
  "lastName": "",
  "address1": "",
  "address2": "",
  "city": "",
  "state": "",
  "zipCode": "",
  "phone": "",
  "email": "",
  "jobRole": ""
}

Rules:
- Extract city/state from address
- jobRole = latest job title
- Return empty string if missing
`

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.GROK_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "grok-beta",
      temperature: 0,
      messages: [
        { role: "user", content: prompt + text }
      ]
    })
  })

  const data = await response.json()

  const raw = data.choices?.[0]?.message?.content || ""

  // ✅ CLEAN JSON (VERY IMPORTANT)
  const clean = raw.match(/\{[\s\S]*\}/)?.[0] || "{}"

  let parsed = {}

  try {
    parsed = JSON.parse(clean)
  } catch {
    parsed = {}
  }

  return NextResponse.json(parsed)
}