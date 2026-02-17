import { NextResponse } from "next/server";
import { callGatewayRpc } from "@/src/lib/openclawGateway";

interface ModelEntry {
  id: string;
  name: string;
  provider?: string;
}

interface ModelsListResponse {
  models?: Array<{
    id?: string;
    name?: string;
    alias?: string;
    provider?: string;
    modelId?: string;
  }>;
  // Some versions return a flat object keyed by model ID
  [key: string]: unknown;
}

export const runtime = "nodejs";

// ──────────────────────────────────────────────
// GET /api/models → fetch available models from Gateway
// ──────────────────────────────────────────────

export async function GET() {
  try {
    // Try models.list RPC first (primary method)
    const result = await callGatewayRpc<ModelsListResponse>("models.list");

    let models: ModelEntry[] = [];

    if (Array.isArray(result.models)) {
      // Standard array response
      models = result.models.map((m) => ({
        id: m.id ?? m.modelId ?? "unknown",
        name: m.alias ?? m.name ?? m.id ?? "Unknown Model",
        provider: m.provider,
      }));
    } else if (result && typeof result === "object") {
      // Object-keyed response (older format): { "provider/model": { alias, ... } }
      models = Object.entries(result)
        .filter(([key]) => key !== "models" && key.includes("/"))
        .map(([id, val]) => ({
          id,
          name:
            typeof val === "object" && val !== null && "alias" in val
              ? String((val as { alias: string }).alias)
              : id,
        }));
    }

    return NextResponse.json({ models });
  } catch (error) {
    console.error("[/api/models GET] Gateway RPC failed:", error);

    // Fallback: try reading from status which may include model info
    try {
      const status = await callGatewayRpc<{
        config?: { agents?: { defaults?: { models?: Record<string, { alias?: string }> } } };
      }>("status");

      const modelsConfig = status?.config?.agents?.defaults?.models ?? {};
      const models = Object.entries(modelsConfig).map(([id, val]) => ({
        id,
        name: val?.alias ?? id,
      }));

      return NextResponse.json({ models, source: "status-fallback" });
    } catch {
      // Both methods failed
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to load models",
          models: [],
        },
        { status: 200 },
      );
    }
  }
}
