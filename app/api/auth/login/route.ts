import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  createSessionToken,
  getAuthConfig,
  sessionCookieOptions,
  verifyPassword,
} from "@/src/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const config = getAuthConfig();
  if (!config) {
    return NextResponse.json(
      { error: "ZimZ is not configured for authentication" },
      { status: 503 },
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

  const response = NextResponse.json({ ok: true });
  const secure = request.headers.get("x-forwarded-proto") === "https";
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(config.secret),
    sessionCookieOptions(secure),
  );
  return response;
}
