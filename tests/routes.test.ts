import { beforeEach, describe, expect, it, vi } from "vitest";

// The Gateway client is the boundary under test: every assertion below is
// about which RPC the route sends and with which params.
const gatewayRpc = vi.fn();
const fireGatewayRpc = vi.fn();

vi.mock("@/src/lib/openclawGateway", () => ({
  gatewayRpc: (method: string, params?: unknown) => gatewayRpc(method, params),
  fireGatewayRpc: (method: string, params?: unknown) => fireGatewayRpc(method, params),
  callGatewayRpc: (method: string, params?: unknown) => gatewayRpc(method, params),
  gatewayEvents: { connect: vi.fn(), isConnected: () => true },
}));

import { DELETE as deleteAgent, PATCH as patchAgent } from "@/app/api/agents/[id]/route";
import { GET as listAgents, POST as createAgent } from "@/app/api/agents/route";
import { DELETE as deleteCron, PATCH as patchCron } from "@/app/api/cron/jobs/[jobId]/route";
import { POST as runCron } from "@/app/api/cron/jobs/[jobId]/run/route";

/** Params are a Promise in the App Router route signature. */
const ctx = <T extends object>(params: T) => ({ params: Promise.resolve(params) });

const jsonRequest = (body: unknown) =>
  new Request("http://localhost:3000/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** Find the single call for `method`, failing loudly if it did not happen. */
const callTo = (method: string) => {
  const call = gatewayRpc.mock.calls.find(([m]) => m === method);
  expect(call, `expected an RPC to ${method}`).toBeDefined();
  return call![1];
};

beforeEach(() => {
  gatewayRpc.mockReset();
  fireGatewayRpc.mockReset();
});

// ──────────────────────────────────────────────
// Destructive endpoints
// ──────────────────────────────────────────────

describe("DELETE /api/agents/[id]", () => {
  it("deletes by agentId and leaves workspace files on disk", async () => {
    gatewayRpc.mockResolvedValue({});

    const res = await deleteAgent(new Request("http://localhost/x"), ctx({ id: "sigi" }));

    expect(res.status).toBe(200);
    // The Gateway keys agents by agentId; `id` would be rejected outright.
    expect(callTo("agents.delete")).toEqual({ agentId: "sigi" });
    // deleteFiles stays off so a mistaken delete remains recoverable.
    expect(callTo("agents.delete")).not.toHaveProperty("deleteFiles");
    expect(callTo("agents.delete")).not.toHaveProperty("force");
  });

  it("reports a Gateway failure as an error, not a success", async () => {
    gatewayRpc.mockRejectedValue(new Error("agent not found"));

    const res = await deleteAgent(new Request("http://localhost/x"), ctx({ id: "ghost" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toMatchObject({ error: "agent not found" });
  });
});

describe("DELETE /api/cron/jobs/[jobId]", () => {
  it("removes the job by id", async () => {
    gatewayRpc.mockResolvedValue({});

    const res = await deleteCron(new Request("http://localhost/x"), ctx({ jobId: "job-1" }));

    expect(res.status).toBe(200);
    expect(callTo("cron.remove")).toEqual({ jobId: "job-1" });
  });
});

describe("POST /api/cron/jobs/[jobId]/run", () => {
  it("forces an immediate run of exactly the requested job", async () => {
    fireGatewayRpc.mockResolvedValue(undefined);

    const res = await runCron(new Request("http://localhost/x"), ctx({ jobId: "job-1" }));

    expect(res.status).toBe(200);
    expect(fireGatewayRpc).toHaveBeenCalledWith("cron.run", {
      jobId: "job-1",
      mode: "force",
    });
  });
});

// ──────────────────────────────────────────────
// Writing endpoints
// ──────────────────────────────────────────────

describe("PATCH /api/agents/[id]", () => {
  it("writes SOUL.md and MEMORY.md through agents.files.set", async () => {
    gatewayRpc.mockResolvedValue({});

    const res = await patchAgent(
      jsonRequest({ soulMd: "# soul", memoryMd: "# memory" }),
      ctx({ id: "sigi" }),
    );

    expect(res.status).toBe(200);
    const writes = gatewayRpc.mock.calls.filter(([m]) => m === "agents.files.set");
    expect(writes).toHaveLength(2);
    expect(writes.map(([, p]) => p)).toEqual(
      expect.arrayContaining([
        { agentId: "sigi", name: "SOUL.md", content: "# soul" },
        { agentId: "sigi", name: "MEMORY.md", content: "# memory" },
      ]),
    );
    // File-only edits must not trigger a config update.
    expect(gatewayRpc.mock.calls.some(([m]) => m === "agents.update")).toBe(false);
  });

  it("forwards only allowlisted fields to agents.update", async () => {
    gatewayRpc.mockResolvedValue({});

    await patchAgent(
      jsonRequest({
        model: "anthropic/claude-sonnet-5",
        name: "Sigi",
        identity: { emoji: "🤖", avatar: "a.png", theme: "dark" },
        // None of the following may reach the Gateway.
        workspace: "/etc",
        sandbox: { disabled: true },
        tools: ["shell"],
      }),
      ctx({ id: "sigi" }),
    );

    expect(callTo("agents.update")).toEqual({
      agentId: "sigi",
      model: "anthropic/claude-sonnet-5",
      name: "Sigi",
      emoji: "🤖",
      avatar: "a.png",
    });
  });

  it("takes the agent id from the path, never from the body", async () => {
    gatewayRpc.mockResolvedValue({});

    await patchAgent(
      jsonRequest({ id: "main", agentId: "main", model: "x" }),
      ctx({ id: "sigi" }),
    );

    expect(callTo("agents.update")).toMatchObject({ agentId: "sigi" });
  });
});

describe("POST /api/agents", () => {
  it("creates via agents.create and reports the assigned id", async () => {
    gatewayRpc.mockResolvedValue({
      ok: true,
      // The Gateway normalizes the name, so the id it returns can differ.
      agentId: "newagent",
      name: "New Agent",
      workspace: "/root/.openclaw/workspace-newagent",
    });

    const res = await createAgent(jsonRequest({ name: "New Agent", model: "m" }));

    expect(res.status).toBe(200);
    expect(callTo("agents.create")).toEqual({
      name: "New Agent",
      workspace: "~/.openclaw/workspace-New Agent",
      model: "m",
    });
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      agent: { id: "newagent" },
    });
  });

  it("never sends the nested identity object the Gateway rejects", async () => {
    gatewayRpc.mockResolvedValue({ ok: true, agentId: "a", name: "a", workspace: "/w" });

    await createAgent(jsonRequest({ name: "a", identity: { name: "a", theme: "dark" } }));

    // agents.create validates with additionalProperties: false.
    expect(callTo("agents.create")).not.toHaveProperty("identity");
    expect(callTo("agents.create")).not.toHaveProperty("id");
  });

  it("rejects a body with no usable name", async () => {
    const res = await createAgent(jsonRequest({ model: "m" }));

    expect(res.status).toBe(400);
    expect(gatewayRpc).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// Failure reporting
// ──────────────────────────────────────────────

describe("GET /api/agents", () => {
  it("answers 502 when the Gateway is unreachable", async () => {
    gatewayRpc.mockRejectedValue(new Error("protocol mismatch"));

    const res = await listAgents();

    // A 200 with an empty list is what hid a real outage for two days.
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({
      error: "protocol mismatch",
      agents: [],
    });
  });
});

describe("PATCH /api/cron/jobs/[jobId]", () => {
  it("wraps the body in a patch envelope", async () => {
    gatewayRpc.mockResolvedValue({});

    await patchCron(jsonRequest({ enabled: false }), ctx({ jobId: "job-1" }));

    expect(callTo("cron.update")).toEqual({
      jobId: "job-1",
      patch: { enabled: false },
    });
  });
});
