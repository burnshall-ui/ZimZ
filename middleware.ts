import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  getAuthConfig,
  isAllowedOrigin,
  verifySessionToken,
} from "@/src/lib/auth";

// Node.js runtime, not Edge: keeps `process.env` a runtime lookup so the
// password and session secret are never inlined into the build output.
export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|screenshots/).*)"],
};

/** Paths that must stay reachable without a session, or login is impossible. */
const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  // Static assets served straight from public/
  return /\.(?:png|svg|ico|webmanifest|json|gif|jpg|jpeg|woff2?)$/.test(pathname);
}

function unauthorized(request: NextRequest): NextResponse {
  // API callers get a status they can act on; a redirect would hand `fetch`
  // an HTML login page and surface as a confusing JSON parse error.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  const target = request.nextUrl.pathname + request.nextUrl.search;
  if (target !== "/") loginUrl.searchParams.set("next", target);
  return NextResponse.redirect(loginUrl);
}

export async function middleware(request: NextRequest) {
  const config = getAuthConfig();

  // Fail closed. Every API route talks to the Gateway with operator.admin
  // scope, so an unconfigured deployment must not serve traffic at all.
  if (!config) {
    return NextResponse.json(
      {
        error:
          "ZimZ is not configured: set ZIMZ_AUTH_PASSWORD and ZIMZ_SESSION_SECRET before starting.",
      },
      { status: 503 },
    );
  }

  const { pathname } = request.nextUrl;

  // CSRF guard runs before the public-path check so the login endpoint is
  // covered too — otherwise it stays open to cross-origin password guessing.
  if (
    !isAllowedOrigin(
      request.method,
      request.headers.get("origin"),
      request.headers.get("host"),
      config.allowedOrigins,
    )
  ) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }

  if (isPublic(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token, config.secret))) {
    return unauthorized(request);
  }

  return NextResponse.next();
}
