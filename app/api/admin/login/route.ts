import { NextResponse } from "next/server";

export async function POST(req: Request) {

  const { password } = await req.json();

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD non configurata" },
      { status: 500 }
    );
  }

  if (password !== adminPassword) {
    return NextResponse.json(
      { error: "Password errata" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set("admin_auth", "1", {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}