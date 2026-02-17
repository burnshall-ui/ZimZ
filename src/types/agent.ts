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

/** Single agent entry as returned by agents.list RPC */
export interface GatewayAgentEntry {
  id: string;
  name?: string;
  default?: boolean;
  workspace?: string;
  agentDir?: string;
  model?: string;
  modelType?: string;
  identity?: AgentIdentity;
  sandbox?: unknown;
  tools?: unknown;
}

/** Response from agents.list RPC */
export interface AgentsListResponse {
  agents?: GatewayAgentEntry[];
  list?: GatewayAgentEntry[];
}

/** Params for agents.add RPC */
export interface AgentAddParams {
  id: string;
  name?: string;
  workspace?: string;
  model?: string;
  identity?: AgentIdentity;
}

/** Params for agents.delete RPC */
export interface AgentDeleteParams {
  id: string;
  force?: boolean;
}

/** Params for agents.update / config update RPC */
export interface AgentUpdateParams {
  id: string;
  model?: string;
  identity?: AgentIdentity;
  name?: string;
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
    modelType: entry.model ?? entry.modelType ?? "not configured",
    logs: [],
    soulMd: `# ${displayName}\n\nOpenClaw Agent`,
    memoryMd: "# Memory\n\nAgent Memory",
    workspace: entry.workspace,
    identity: entry.identity,
    isDefault: entry.default,
  };
}
