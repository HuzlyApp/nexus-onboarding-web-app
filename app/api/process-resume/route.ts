import { NextResponse } from "next/server"
import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1"
})

export async function POST(req: Request){

  const body = await req.json()

  const completion = await client.chat.completions.create({

    model: "grok-4-fast",

    messages: [

      {
        role: "system",
        content: `
You are an ATS resume parser.

Extract structured information from the resume.

Return JSON ONLY.

Schema:

{
"first_name":"",
"last_name":"",
"address1":"",
"address2":"",
"city":"",
"state":"",
"phone":"",
"email":"",
"job_role":""
}

Rules:

Split full name into first_name and last_name.

Detect healthcare roles such as:
CNA, RN, LPN, Caregiver, Medical Assistant.

If a field is missing return an empty string.
`
      },

      {
        role: "user",
        content: body.text
      }

    ]

  })

  const result = completion.choices?.[0]?.message?.content || ""

  let parsed

  try{
    parsed = JSON.parse(result)
  }catch{
    parsed = {
      first_name:"",
      last_name:"",
      address1:"",
      address2:"",
      city:"",
      state:"",
      phone:"",
      email:"",
      job_role:""
    }
  }

  return NextResponse.json(parsed)

}