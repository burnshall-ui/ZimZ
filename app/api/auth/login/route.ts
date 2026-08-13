import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  clearLoginAttempts,
  createSessionToken,
  getAuthConfig,
  registerLoginAttempt,
  sessionCookieOptions,
  verifyPassword,
} from "@/src/lib/auth";

export const runtime = "nodejs";

/**
 * Best-effort client identifier for rate limiting. Behind Tailscale Serve or
 * a reverse proxy the real address only survives in this header — a plain
 * `Request` has no socket to fall back to. Falling back to a shared "unknown"
 * key when it's missing still rate-limits the endpoint as a whole, just
 * without per-client granularity.
 */
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  const config = getAuthConfig();
  if (!config) {
    return NextResponse.json(
      { error: "ZimZ is not configured for authentication" },
      { status: 503 },
    );
  }

  const key = clientKey(request);
  if (registerLoginAttempt(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  let password: unknown;
  try {
    ({ password } = (await request.json()) as { password?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (typeof password !== "string" || !(await verifyPassword(password, config.password))) {
    // Deliberately vague: nothing here should help enumerate the password.
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  clearLoginAttempts(key);

  const response = NextResponse.json({ ok: true });
  const secure = request.headers.get("x-forwarded-proto") === "https";
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(config.secret),
    sessionCookieOptions(secure),
  );
  return response;
}
