import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import type { Agent } from "@/src/types/agent";

const execAsync = promisify(exec);

interface AgentAddParams {
  id: string;
  workspace?: string;
  name?: string;
  model?: string;
  initialTask?: string;
}

export const runtime = "nodejs";

export async function GET() {
  try {
    // Use openclaw CLI to list agents
    const { stdout } = await execAsync("openclaw agents list --json 2>&1 || openclaw agents list");

    let agents: Agent[] = [];

    try {
      // Try to parse JSON output
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed)) {
        agents = parsed.map((a: any) => ({
          id: a.id || "unknown",
          name: a.name || a.identity?.name || a.id || "Unknown",
          status: "idle" as const,
          currentTask: "Bereit",
          modelType: a.model || a.modelType || "Grok Fast",
          logs: [],
          soulMd: `# ${a.name || a.id}\n\nOpenClaw Agent`,
          memoryMd: "# Memory\n\nAgent Memory"
        }));
      }
    } catch {
      // Parse text output if JSON parsing fails
      const lines = stdout.split('\n').filter(line => line.includes('-'));
      agents = lines.map(line => {
        const match = line.match(/^\s*-\s*(\S+)/);
        const id = match ? match[1] : "unknown";
        const nameMatch = line.match(/\(([^)]+)\)/);
        const name = nameMatch ? nameMatch[1] : id;

        return {
          id,
          name: name + " 👾",
          status: "idle" as const,
          currentTask: "Bereit für Tasks",
          modelType: "Grok Fast",
          logs: [],
          soulMd: `# ${name}\n\nOpenClaw Agent`,
          memoryMd: "# Memory\n\nAgent Memory"
        };
      }).filter(a => a.id !== "unknown");
    }

    if (agents.length === 0) {
      // Fallback agent
      agents = [{
        id: "alex-summarizer",
        name: "Alex 👾",
        status: "idle" as const,
        currentTask: "Bereit",
        modelType: "openrouter/x-ai/grok-4.1-fast",
        logs: [],
        soulMd: "# Alex\n\nOpenClaw Agent",
        memoryMd: "# Memory\n\nAgent Memory"
      }];
    }

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Agents fetch failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load agents",
        agents: [{
          id: "alex-summarizer",
          name: "Alex 👾",
          status: "idle" as const,
          currentTask: "CLI Error",
          modelType: "Grok Fast",
          logs: [],
          soulMd: "# Alex",
          memoryMd: ""
        }]
      },
      { status: 200 } // Return 200 with fallback
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentAddParams;

    if (!body.id) {
      return NextResponse.json({ error: "Agent ID is required" }, { status: 400 });
    }

    // Build workspace path if not provided
    const workspace = body.workspace || `~/.openclaw/workspace-${body.id}`;

    // Prepare CLI command (name is positional argument)
    const args = [
      body.id, // Agent ID as positional argument
      body.model ? `--model "${body.model}"` : "",
      `--workspace "${workspace}"`,
      "--non-interactive", // Disable prompts
    ].filter(Boolean).join(" ");

    // Use openclaw CLI to add agent
    const cmd = `openclaw agents add ${args}`;
    const { stdout, stderr } = await execAsync(cmd);

    return NextResponse.json({
      success: true,
      agent: {
        id: body.id,
        name: body.name || body.id,
        workspace,
      },
      output: stdout || stderr
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
