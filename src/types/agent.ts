// ──────────────────────────────────────────────
// Agent status (derived from Gateway events)
// working -> Dev Lab | collaborating -> Meeting Room | idle/waiting -> Lounge
// ──────────────────────────────────────────────

export type AgentStatus = "working" | "collaborating" | "idle" | "waiting";

// ──────────────────────────────────────────────
// Identity (matches agents.list[].identity in openclaw.json)
// ──────────────────────────────────────────────

export interface AgentIdentity {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
}

// ──────────────────────────────────────────────
// Agent as displayed in the dashboard
// Combines OpenClaw config data with runtime state
// ──────────────────────────────────────────────

export interface Agent {
  /** Unique agent ID (e.g. "main", "work", "sigi") */
  id: string;
  /** Display name (from identity.name or id) */
  name: string;
  /** Runtime status derived from Gateway events */
  status: AgentStatus;
  /** Current task / last activity description */
  currentTask: string;
  /** Model identifier (e.g. "anthropic/claude-sonnet-4-5") */
  modelType: string;
  /** Recent log entries */
  logs: string[];

  // OpenClaw workspace files (editable in Settings tab)
  soulMd: string;
  memoryMd: string;

  // OpenClaw-specific fields (optional, enriched from Gateway)
  /** Workspace path on the server */
  workspace?: string;
  /** Agent identity config */
  identity?: AgentIdentity;
  /** Whether this is the default agent */
  isDefault?: boolean;
}

// ──────────────────────────────────────────────
// Gateway RPC response types
// ──────────────────────────────────────────────

/** Model field may be a plain string or an object like { primary, fallback } */
export type GatewayModel = string | { primary?: string; fallback?: string; id?: string };

/** Single agent entry as returned by agents.list RPC */
export interface GatewayAgentEntry {
  id: string;
  name?: string;
  default?: boolean;
  workspace?: string;
  agentDir?: string;
  model?: GatewayModel;
  modelType?: GatewayModel;
  identity?: AgentIdentity;
  sandbox?: unknown;
  tools?: unknown;
  soulMd?: string;
  memoryMd?: string;
}

function normalizeModel(m: GatewayModel | undefined): string {
  if (typeof m === "string") return m;
  if (m && typeof m === "object") {
    return m.primary ?? m.id ?? m.fallback ?? "not configured";
  }
  return "not configured";
}

/** Response from agents.list RPC */
export interface AgentsListResponse {
  agents?: GatewayAgentEntry[];
  list?: GatewayAgentEntry[];
}

// ──────────────────────────────────────────────
// Request bodies accepted by the ZimZ API routes
// ──────────────────────────────────────────────

/** Body for POST /api/agents */
export interface AgentAddParams {
  id?: string;
  name?: string;
  workspace?: string;
  model?: string;
  identity?: AgentIdentity;
}

/** Body for PATCH /api/agents/[id] — the id comes from the path, never the body */
export interface AgentUpdateParams {
  model?: string;
  name?: string;
  identity?: AgentIdentity;
}

// ──────────────────────────────────────────────
// Gateway RPC params
//
// The Gateway validates these with additionalProperties: false, so the shapes
// below must match its schema exactly. Note that it keys agents by `agentId`,
// not `id`, and takes identity as flat `emoji` / `avatar` fields.
// ──────────────────────────────────────────────

/** Params for agents.create — the Gateway derives agentId from `name`. */
export interface GatewayAgentsCreateParams {
  name: string;
  workspace: string;
  model?: string;
  emoji?: string;
  avatar?: string;
}

/** Result of agents.create */
export interface GatewayAgentsCreateResult {
  ok: true;
  agentId: string;
  name: string;
  workspace: string;
  model?: string;
}

/** Params for agents.update */
export interface GatewayAgentsUpdateParams {
  agentId: string;
  name?: string;
  workspace?: string;
  model?: string;
  emoji?: string;
  avatar?: string;
}

/** Params for agents.delete */
export interface GatewayAgentsDeleteParams {
  agentId: string;
  deleteFiles?: boolean;
}

// ──────────────────────────────────────────────
// Helper: Convert Gateway entry to dashboard Agent
// ──────────────────────────────────────────────

export function gatewayEntryToAgent(entry: GatewayAgentEntry): Agent {
  const displayName =
    entry.identity?.name ?? entry.name ?? entry.id;

  return {
    id: entry.id,
    name: displayName,
    status: "idle",
    currentTask: "Ready",
    modelType: normalizeModel(entry.model ?? entry.modelType),
    logs: [],
    soulMd: entry.soulMd ?? `# ${displayName}\n\nOpenClaw Agent`,
    memoryMd: entry.memoryMd ?? "# Memory\n\nAgent Memory",
    workspace: entry.workspace,
    identity: entry.identity,
    isDefault: entry.default,
  };
}
