import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { SESSION_COOKIE, createSessionToken } from "@/src/lib/auth";

const PASSWORD = "test-password";
const SECRET = "test-session-secret";
const HOST = "zimz.example";
const ORIGIN = `https://${HOST}`;

interface RequestOptions {
  method?: string;
  origin?: string | null;
  cookie?: string;
}

function request(pathname: string, options: RequestOptions = {}): NextRequest {
  const headers = new Headers({ host: HOST });
  if (options.origin !== null) headers.set("origin", options.origin ?? ORIGIN);
  if (options.cookie) headers.set("cookie", `${SESSION_COOKIE}=${options.cookie}`);

  return new NextRequest(new URL(pathname, ORIGIN), {
    method: options.method ?? "GET",
    headers,
  });
}

/** NextResponse.next() has no explicit status; it passes through as 200. */
const passedThrough = (res: Response) => res.status === 200 && !res.headers.get("location");

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  envBackup = { ...process.env };
  process.env.ZIMZ_AUTH_PASSWORD = PASSWORD;
  process.env.ZIMZ_SESSION_SECRET = SECRET;
  delete process.env.ZIMZ_ALLOWED_ORIGINS;
});

afterEach(() => {
  process.env = envBackup;
});

describe("fail-closed configuration", () => {
  it("refuses to serve anything when the password is unset", async () => {
    delete process.env.ZIMZ_AUTH_PASSWORD;

    const res = await middleware(request("/api/agents"));

    // 503, not "allow through" — the alternative is an open admin proxy.
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("ZIMZ_AUTH_PASSWORD"),
    });
  });

  it("refuses to serve anything when the session secret is unset", async () => {
    delete process.env.ZIMZ_SESSION_SECRET;
    expect((await middleware(request("/login"))).status).toBe(503);
  });
});

describe("origin check", () => {
  it("rejects a cross-origin POST that carries no preflight", async () => {
    // Content-Type: text/plain makes this a CORS simple request, so it reaches
    // the route handler unannounced. request.json() parses it regardless.
    const res = await middleware(
      request("/api/cron/jobs", { method: "POST", origin: "https://evil.example" }),
    );

    expect(res.status).toBe(403);
  });

  it("rejects mutating requests with no Origin header at all", async () => {
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const res = await middleware(request("/api/agents/x", { method, origin: null }));
      expect(res.status, method).toBe(403);
    }
  });

  it("guards the login endpoint too", async () => {
    const res = await middleware(
      request("/api/auth/login", { method: "POST", origin: "https://evil.example" }),
    );

    // Otherwise the login route stays open to cross-origin password guessing.
    expect(res.status).toBe(403);
  });

  it("allows same-origin mutations to continue to auth", async () => {
    const res = await middleware(request("/api/agents", { method: "POST" }));

    // Not 403 — it fails on the session instead.
    expect(res.status).toBe(401);
  });

  it("honours ZIMZ_ALLOWED_ORIGINS", async () => {
    process.env.ZIMZ_ALLOWED_ORIGINS = "https://proxy.example";
    const res = await middleware(
      request("/api/auth/login", { method: "POST", origin: "https://proxy.example" }),
    );

    expect(passedThrough(res)).toBe(true);
  });

  it("does not gate read-only requests on Origin", async () => {
    const res = await middleware(
      request("/api/agents", { origin: "https://evil.example" }),
    );

    // Rejected for the missing session, not for the origin.
    expect(res.status).toBe(401);
  });
});

describe("session requirement", () => {
  it("answers 401 for API routes rather than redirecting", async () => {
    const res = await middleware(request("/api/agents"));

    // A redirect would hand fetch() an HTML login page and surface as a
    // JSON parse error at the call site.
    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects page requests to /login and preserves the target", async () => {
    const res = await middleware(request("/tasks?view=grid"));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/tasks?view=grid");
  });

  it("lets a valid session through", async () => {
    const token = await createSessionToken(SECRET);
    const res = await middleware(request("/api/agents", { cookie: token }));

    expect(passedThrough(res)).toBe(true);
  });

  it("rejects a tampered cookie", async () => {
    const token = await createSessionToken(SECRET);
    const [payload] = token.split(".");
    const res = await middleware(
      request("/api/agents", { cookie: `${payload}.forged-signature` }),
    );

    expect(res.status).toBe(401);
  });

  it("rejects a cookie signed with a different secret", async () => {
    const token = await createSessionToken("some-other-secret");
    const res = await middleware(request("/api/agents", { cookie: token }));

    expect(res.status).toBe(401);
  });

  it("keeps /login and /api/auth/login reachable without a session", async () => {
    expect(passedThrough(await middleware(request("/login")))).toBe(true);
    expect(
      passedThrough(await middleware(request("/api/auth/login", { method: "POST" }))),
    ).toBe(true);
  });
});
