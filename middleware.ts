import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  const isLoginPage = pathname === "/admin/login";
  const isLoginApi = pathname === "/api/admin/login";

  // lascia stare tutto ciò che non è admin
  if (!(isAdminPage || isAdminApi)) {
    return NextResponse.next();
  }

  // lascia passare login
  if (isLoginPage || isLoginApi) {
    return NextResponse.next();
  }

  const authCookie = req.cookies.get("admin_auth")?.value;

  if (authCookie === "1") {
    return NextResponse.next();
  }

  // pagine admin -> redirect a login
  if (isAdminPage) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // api admin -> 401
  return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};