import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/auth/login/route";
import { LOGIN_RATE_LIMIT_MAX_ATTEMPTS, clearLoginAttempts } from "@/src/lib/auth";

const PASSWORD = "test-password";
const SECRET = "test-session-secret";

/** Distinct per test so the shared rate-limit map doesn't leak between them. */
let ip: string;
let seq = 0;

function request(body: unknown, options: { ip?: string | null } = {}): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  const forwardedFor = options.ip === null ? undefined : (options.ip ?? ip);
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);

  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  envBackup = { ...process.env };
  process.env.ZIMZ_AUTH_PASSWORD = PASSWORD;
  process.env.ZIMZ_SESSION_SECRET = SECRET;
  ip = `198.51.100.${seq++}`;
});

afterEach(() => {
  process.env = envBackup;
  clearLoginAttempts(ip);
  clearLoginAttempts("unknown");
});

describe("POST /api/auth/login rate limiting", () => {
  it("refuses the request after the attempt limit is exceeded", async () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS; i++) {
      const res = await login(request({ password: "wrong" }));
      expect(res.status, `attempt ${i + 1}`).toBe(401);
    }

    const res = await login(request({ password: "wrong" }));
    expect(res.status).toBe(429);
  });

  it("counts attempts per client key, not globally", async () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS; i++) {
      await login(request({ password: "wrong" }));
    }
    expect((await login(request({ password: "wrong" }))).status).toBe(429);

    const otherIp = `${ip}-other`;
    const res = await login(request({ password: PASSWORD }, { ip: otherIp }));
    expect(res.status).toBe(200);
    clearLoginAttempts(otherIp);
  });

  it("clears the attempt count on a successful login", async () => {
    for (let i = 0; i < LOGIN_RATE_LIMIT_MAX_ATTEMPTS - 1; i++) {
      await login(request({ password: "wrong" }));
    }

    const success = await login(request({ password: PASSWORD }));
    expect(success.status).toBe(200);

    // A fresh run of failed attempts should not immediately hit the limit
    // left over from before the successful login.
    const res = await login(request({ password: "wrong" }));
    expect(res.status).toBe(401);
  });
});
