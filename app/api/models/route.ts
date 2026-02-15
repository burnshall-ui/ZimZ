import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

interface ModelConfig {
  alias?: string;
}

export async function GET() {
  try {
    // Read openclaw config
    const configPath = join(process.env.HOME || "/home/canni", ".openclaw/openclaw.json");
    const configData = await readFile(configPath, "utf-8");
    const config = JSON.parse(configData);

    // Extract available models from agents.defaults.models
    const modelsConfig = config?.agents?.defaults?.models || {};

    const models = Object.keys(modelsConfig).map((modelId) => ({
      id: modelId,
      name: modelsConfig[modelId]?.alias || modelId,
    }));

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Failed to load models:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load models",
        models: []
      },
      { status: 200 } // Return 200 with empty array as fallback
    );
  }
}
