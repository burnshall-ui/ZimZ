// ──────────────────────────────────────────────
// Session auth + CSRF helpers
//
// Uses Web Crypto only, so this module works both in the Next.js
// middleware (Edge runtime) and in Node.js route handlers.
// ──────────────────────────────────────────────

export const SESSION_COOKIE = "zimz_session";

/** Session lifetime — a fresh login is required after this. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Methods that change state and therefore need an Origin check. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface AuthConfig {
  password: string;
  secret: string;
  /** Extra origins allowed to send mutating requests, beyond the request's own Host. */
  allowedOrigins: string[];
}

/**
 * Read auth config from the environment.
 *
 * Returns null when the deployment is not configured. Callers must treat that
 * as "refuse to serve" — there is deliberately no unauthenticated mode, since
 * every API route reaches the Gateway with operator.admin scope.
 */
export function getAuthConfig(): AuthConfig | null {
  const password = process.env.ZIMZ_AUTH_PASSWORD;
  const secret = process.env.ZIMZ_SESSION_SECRET;
  if (!password || !secret) return null;

  const allowedOrigins = (process.env.ZIMZ_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  return { password, secret, allowedOrigins };
}

// ──────────────────────────────────────────────
// Encoding helpers
// ──────────────────────────────────────────────

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Compare two strings without leaking their contents through timing. */
function timingSafeEqual(a: string, b: string): boolean {
  // Length alone is not secret here, but keep the loop constant over max length.
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

// ──────────────────────────────────────────────
// Password check
// ──────────────────────────────────────────────

/**
 * Constant-time password comparison.
 *
 * Both sides are hashed first so the comparison always runs over two equal
 * length digests and the candidate's length is not observable.
 */
export async function verifyPassword(candidate: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return timingSafeEqual(
    base64UrlEncode(new Uint8Array(a)),
    base64UrlEncode(new Uint8Array(b)),
  );
}

// ──────────────────────────────────────────────
// Session token: "<base64url(expiryMs)>.<base64url(HMAC(secret, expiryMs))>"
// ──────────────────────────────────────────────

export async function createSessionToken(
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const expiry = String(now + SESSION_TTL_MS);
  const payload = base64UrlEncode(new TextEncoder().encode(expiry));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  // Verify the signature before trusting anything inside the payload.
  if (!timingSafeEqual(signature, await hmac(secret, payload))) return false;

  const decoded = base64UrlDecode(payload);
  if (!decoded) return false;

  const expiry = Number(new TextDecoder().decode(decoded));
  return Number.isFinite(expiry) && expiry > now;
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

// ──────────────────────────────────────────────
// CSRF: origin check for mutating requests
// ──────────────────────────────────────────────

/**
 * Decide whether a mutating request may proceed.
 *
 * Route handlers parse JSON regardless of Content-Type, so a cross-origin
 * `POST` with `Content-Type: text/plain` is a CORS "simple request" and reaches
 * them without a preflight. Requiring a same-origin `Origin` header is what
 * stops that.
 */
export function isAllowedOrigin(
  method: string,
  origin: string | null,
  host: string | null,
  allowedOrigins: string[],
): boolean {
  if (!MUTATING_METHODS.has(method.toUpperCase())) return true;

  // A mutating request without Origin is either a non-browser client or an
  // attempt to dodge the check. Refuse either way.
  if (!origin) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }

  if (host && originHost === host) return true;
  return allowedOrigins.some((allowed) => {
    try {
      return new URL(allowed).host === originHost;
    } catch {
      return allowed === originHost;
    }
  });
}
