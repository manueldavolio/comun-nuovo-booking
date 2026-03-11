import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";

  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge || "", { status: 200 });
  }

  return new NextResponse("Verification failed", { status: 403 });
}

export async function POST() {
  return NextResponse.json({ ok: true });
}

