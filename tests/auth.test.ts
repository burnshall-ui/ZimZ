import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  createSessionToken,
  getAuthConfig,
  isAllowedOrigin,
  verifyPassword,
  verifySessionToken,
} from "@/src/lib/auth";

const SECRET = "test-secret-value";

describe("getAuthConfig", () => {
  it("returns null unless both password and secret are set", () => {
    const original = { ...process.env };
    try {
      delete process.env.ZIMZ_AUTH_PASSWORD;
      delete process.env.ZIMZ_SESSION_SECRET;
      expect(getAuthConfig()).toBeNull();

      process.env.ZIMZ_AUTH_PASSWORD = "pw";
      expect(getAuthConfig()).toBeNull();

      process.env.ZIMZ_SESSION_SECRET = SECRET;
      expect(getAuthConfig()).toEqual({
        password: "pw",
        secret: SECRET,
        allowedOrigins: [],
      });
    } finally {
      process.env = original;
    }
  });

  it("parses ZIMZ_ALLOWED_ORIGINS into a trimmed list", () => {
    const original = { ...process.env };
    try {
      process.env.ZIMZ_AUTH_PASSWORD = "pw";
      process.env.ZIMZ_SESSION_SECRET = SECRET;
      process.env.ZIMZ_ALLOWED_ORIGINS = " https://a.example , https://b.example ,";
      expect(getAuthConfig()?.allowedOrigins).toEqual([
        "https://a.example",
        "https://b.example",
      ]);
    } finally {
      process.env = original;
    }
  });
});

describe("verifyPassword", () => {
  it("accepts the exact password and rejects near misses", async () => {
    expect(await verifyPassword("hunter2", "hunter2")).toBe(true);
    expect(await verifyPassword("hunter3", "hunter2")).toBe(false);
    expect(await verifyPassword("hunter2 ", "hunter2")).toBe(false);
    expect(await verifyPassword("", "hunter2")).toBe(false);
    // A prefix must not pass — the digests differ entirely.
    expect(await verifyPassword("hunter", "hunter2")).toBe(false);
  });
});

describe("session tokens", () => {
  it("round-trips a freshly issued token", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, SECRET)).toBe(true);
  });

  it("rejects a missing or malformed token", async () => {
    expect(await verifySessionToken(undefined, SECRET)).toBe(false);
    expect(await verifySessionToken("", SECRET)).toBe(false);
    expect(await verifySessionToken("nodot", SECRET)).toBe(false);
    expect(await verifySessionToken("a.b.c", SECRET)).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken("other-secret");
    expect(await verifySessionToken(token, SECRET)).toBe(false);
  });

  it("rejects a tampered payload even when the signature is reused", async () => {
    const token = await createSessionToken(SECRET);
    const [, signature] = token.split(".");
    const forgedExpiry = Buffer.from(String(Date.now() + 10 * SESSION_TTL_MS))
      .toString("base64url");
    expect(await verifySessionToken(`${forgedExpiry}.${signature}`, SECRET)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const issuedAt = Date.now() - SESSION_TTL_MS - 1000;
    const token = await createSessionToken(SECRET, issuedAt);
    expect(await verifySessionToken(token, SECRET)).toBe(false);
    // Same token was valid at issue time.
    expect(await verifySessionToken(token, SECRET, issuedAt)).toBe(true);
  });
});

describe("isAllowedOrigin", () => {
  const host = "zimz.example:8443";

  it("lets read-only methods through regardless of Origin", () => {
    expect(isAllowedOrigin("GET", null, host, [])).toBe(true);
    expect(isAllowedOrigin("HEAD", "https://evil.example", host, [])).toBe(true);
  });

  it("rejects mutating requests with no Origin header", () => {
    // This is the CORS simple-request path: POST with Content-Type text/plain
    // reaches the route without a preflight, so a missing Origin must fail.
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(isAllowedOrigin(method, null, host, [])).toBe(false);
    }
  });

  it("rejects a foreign Origin", () => {
    expect(isAllowedOrigin("POST", "https://evil.example", host, [])).toBe(false);
    expect(isAllowedOrigin("DELETE", "https://evil.example", host, [])).toBe(false);
  });

  it("accepts a same-origin request", () => {
    expect(isAllowedOrigin("POST", `https://${host}`, host, [])).toBe(true);
  });

  it("accepts an explicitly allowed origin", () => {
    expect(
      isAllowedOrigin("POST", "https://other.example", host, ["https://other.example"]),
    ).toBe(true);
  });

  it("rejects an unparseable Origin", () => {
    expect(isAllowedOrigin("POST", "not-a-url", host, [])).toBe(false);
  });

  it("does not match on a suffix of an allowed host", () => {
    expect(isAllowedOrigin("POST", "https://evilzimz.example", "zimz.example", [])).toBe(
      false,
    );
  });
});
