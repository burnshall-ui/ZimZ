import { NextResponse } from "next/server";
import { gatewayRpc } from "@/src/lib/openclawGateway";

export const runtime = "nodejs";

// ──────────────────────────────────────────────
// GET /api/status → Gateway health + presence
// ──────────────────────────────────────────────

export async function GET() {
  // Fetch health and presence in parallel. allSettled never rejects, so
  // reachability has to be derived from the results — it used to be hardcoded
  // to true, which reported a dead Gateway as healthy.
  const [health, presence] = await Promise.allSettled([
    gatewayRpc<Record<string, unknown>>("health"),
    gatewayRpc<Record<string, unknown>>("system-presence"),
  ]);

  const reachable = health.status === "fulfilled";
  if (!reachable) {
    console.error("[/api/status] Gateway health check failed:", health.reason);
  }

  return NextResponse.json({
    gateway: {
      reachable,
      health: health.status === "fulfilled" ? health.value : null,
      presence: presence.status === "fulfilled" ? presence.value : null,
      ...(reachable
        ? {}
        : {
            error:
              health.reason instanceof Error
                ? health.reason.message
                : "Gateway unreachable",
          }),
    },
    ts: Date.now(),
  });
  // Deliberately 200: this endpoint reports health, so an unreachable Gateway
  // is a valid answer rather than a failure of the endpoint itself.
}
