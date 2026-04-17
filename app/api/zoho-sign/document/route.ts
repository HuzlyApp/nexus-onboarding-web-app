import { NextRequest, NextResponse } from "next/server";
import { fetchZohoSignAccessToken, zohoSignApiBaseCandidates } from "@/lib/zoho-sign-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const requestId = req.nextUrl.searchParams.get("request_id")?.trim() || "";
    const mode = (req.nextUrl.searchParams.get("mode") || "preview").toLowerCase();

    if (!requestId) {
      return NextResponse.json(
        { success: false, error: "Missing request_id query parameter" },
        { status: 400 },
      );
    }

    const accessToken = await fetchZohoSignAccessToken();
    const baseCandidates = zohoSignApiBaseCandidates();

    let pdfBuffer: Buffer | null = null;
    let lastFailure: { base: string; status: number; body: string } | null = null;
    for (const base of baseCandidates) {
      const res = await fetch(
        `${base.replace(/\/$/, "")}/api/v1/requests/${encodeURIComponent(requestId)}/pdf`,
        {
          headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
        },
      );

      if (res.ok) {
        pdfBuffer = Buffer.from(await res.arrayBuffer());
        break;
      }

      lastFailure = {
        base,
        status: res.status,
        body: await res.text(),
      };
    }

    if (!pdfBuffer) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch Zoho document PDF",
          details: lastFailure,
        },
        { status: 502 },
      );
    }

    const fileName = `onboarding-agreement-${requestId}.pdf`;
    const disposition =
      mode === "download"
        ? `attachment; filename="${fileName}"`
        : `inline; filename="${fileName}"`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected document route error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
