import { NextResponse } from "next/server"
import { requireApiSession } from "@/lib/auth/api-session"

export async function GET() {
  const auth = await requireApiSession()
  if (auth instanceof NextResponse) return auth

  const nameFromEmail = auth.email?.split("@")[0]?.replace(/[._-]+/g, " ") ?? ""
  const displayName = nameFromEmail
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

  return NextResponse.json({
    userId: auth.userId,
    email: auth.email,
    role: auth.role,
    displayName: displayName || "User",
  })
}
