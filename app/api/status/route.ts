import { NextResponse } from "next/server";
import { callGatewayRpc } from "@/src/lib/openclawGateway";

export const runtime = "nodejs";

// ──────────────────────────────────────────────
// GET /api/status → Gateway health + presence
// ──────────────────────────────────────────────

export async function GET() {
  try {
    // Fetch health and presence in parallel
    const [health, presence] = await Promise.allSettled([
      callGatewayRpc<Record<string, unknown>>("health"),
      callGatewayRpc<Record<string, unknown>>("system-presence"),
    ]);

    return NextResponse.json({
      gateway: {
        reachable: true,
        health:
          health.status === "fulfilled" ? health.value : null,
        presence:
          presence.status === "fulfilled" ? presence.value : null,
      },
      ts: Date.now(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        gateway: {
          reachable: false,
          error:
            error instanceof Error
              ? error.message
              : "Gateway unreachable",
        },
        ts: Date.now(),
      },
      { status: 200 }, // Still 200 so dashboard renders
    );
  }
}
