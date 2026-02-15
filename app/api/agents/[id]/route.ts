import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "Agent ID is required" }, { status: 400 });
    }

    // Use openclaw CLI to delete agent
    const cmd = `openclaw agents delete "${id}" --force`;
    const { stdout, stderr } = await execAsync(cmd);

    return NextResponse.json({
      success: true,
      deletedAgentId: id,
      output: stdout || stderr
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Use openclaw CLI to get agent info
    const cmd = `openclaw agents list`;
    const { stdout } = await execAsync(cmd);

    // Parse text output to find agent
    const lines = stdout.split('\n');
    const agentLine = lines.find(line => line.includes(id));

    if (!agentLine) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const nameMatch = agentLine.match(/\(([^)]+)\)/);
    const name = nameMatch ? nameMatch[1] : id;

    return NextResponse.json({
      agent: {
        id,
        name,
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
