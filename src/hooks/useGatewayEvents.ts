"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { AgentStatus } from "@/src/types/agent";

// ──────────────────────────────────────────────
// Types for Gateway events
// ──────────────────────────────────────────────

interface GatewaySSEEvent {
  event: string;
  payload: unknown;
  seq?: number;
  stateVersion?: number;
  receivedAt: number;
}

interface ConnectionStatus {
  connected: boolean;
  hello?: unknown;
  ts: number;
}

interface AgentStatusUpdate {
  agentId: string;
  status: AgentStatus;
  task?: string;
  log?: string;
}

// ──────────────────────────────────────────────
// Hook: useGatewayEvents
// Connects to /api/events SSE and provides live updates
// ──────────────────────────────────────────────

export function useGatewayEvents() {
  const [gatewayConnected, setGatewayConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<GatewaySSEEvent | null>(null);
  const [agentUpdates, setAgentUpdates] = useState<Map<string, AgentStatusUpdate>>(
    new Map(),
  );
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectRef = useRef<() => void>(() => {});

  /** Parse agent-related events and derive status updates */
  const processGatewayEvent = useCallback((evt: GatewaySSEEvent) => {
    setLastEvent(evt);

    const payload = evt.payload as Record<string, unknown> | null;
    if (!payload) return;

    // agentId can be direct OR embedded in sessionKey ("agent:{agentId}:...")
    let agentId = (payload.agentId ?? payload.agent) as string | undefined;
    if (!agentId && typeof payload.sessionKey === "string") {
      const parts = payload.sessionKey.split(":");
      if (parts.length >= 2 && parts[0] === "agent") {
        agentId = parts[1];
      }
    }
    if (!agentId) return;

    let update: AgentStatusUpdate | null = null;

    switch (evt.event) {
      case "agent": {
        const stream = payload.stream as string | undefined;
        const data = payload.data as Record<string, unknown> | undefined;

        if (stream === "lifecycle") {
          const phase = data?.phase as string | undefined;
          if (phase === "start") {
            update = { agentId, status: "working", task: "Running…", log: `[${new Date().toLocaleTimeString()}] lifecycle: start` };
          } else if (phase === "end") {
            update = { agentId, status: "idle", log: `[${new Date().toLocaleTimeString()}] lifecycle: end` };
          }
        } else if (stream === "assistant") {
          const text = (data?.text ?? data?.delta) as string | undefined;
          update = {
            agentId,
            status: "working",
            task: text ? text.slice(0, 80) : "Working…",
            log: text ? `[${new Date().toLocaleTimeString()}] ${text.slice(0, 120)}` : undefined,
          };
        }
        break;
      }
      case "cron": {
        const action = payload.action as string | undefined;
        const sessionKey = payload.sessionKey as string | undefined;
        // For "finished" we have sessionKey, for "started" we use the agentId already extracted
        if (action === "started") {
          update = { agentId, status: "working", task: "Cron job running…", log: `[${new Date().toLocaleTimeString()}] cron: started` };
        } else if (action === "finished") {
          // Extract agentId from sessionKey if available for accuracy
          if (sessionKey) {
            const parts = sessionKey.split(":");
            if (parts.length >= 2 && parts[0] === "agent") agentId = parts[1];
          }
          update = { agentId, status: "idle", log: `[${new Date().toLocaleTimeString()}] cron: finished` };
        }
        break;
      }
      case "heartbeat": {
        update = {
          agentId,
          status: "working",
          task: "Heartbeat executed",
          log: `[${new Date().toLocaleTimeString()}] heartbeat: OK`,
        };
        break;
      }
      case "chat": {
        const preview = (payload.preview ?? "Processing message") as string;
        update = {
          agentId,
          status: "working",
          task: preview,
          log: `[${new Date().toLocaleTimeString()}] chat: ${preview.slice(0, 100)}`,
        };
        break;
      }
      case "presence": {
        update = { agentId, status: "collaborating", log: `[${new Date().toLocaleTimeString()}] presence: collaborating` };
        break;
      }
    }

    if (update) {
      setAgentUpdates((prev) => {
        const next = new Map(prev);
        next.set(agentId!, update!);
        return next;
      });
    }
  }, []);

  /** Connect to the SSE endpoint */
  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.addEventListener("status", (e) => {
      try {
        const data = JSON.parse(e.data) as ConnectionStatus;
        setGatewayConnected(data.connected);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("gateway", (e) => {
      try {
        const evt = JSON.parse(e.data) as GatewaySSEEvent;
        processGatewayEvent(evt);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("error", (e) => {
      try {
        console.warn("[SSE] Error event:", e);
      } catch {
        // ignore
      }
    });

    es.onerror = () => {
      // EventSource auto-reconnects, but we track the state
      setGatewayConnected(false);
      eventSourceRef.current = null;
      es.close();

      // Manual reconnect after 5s (use ref to avoid circular dependency)
      if (!reconnectTimerRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connectRef.current();
        }, 5000);
      }
    };
  }, [processGatewayEvent]);

  useEffect(() => {
    // Keep the ref in sync with the latest connect callback
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connect]);

  /** Get the latest status update for a specific agent */
  const getAgentUpdate = useCallback(
    (agentId: string): AgentStatusUpdate | undefined => {
      return agentUpdates.get(agentId);
    },
    [agentUpdates],
  );

  return {
    gatewayConnected,
    lastEvent,
    agentUpdates,
    getAgentUpdate,
  };
}

// ──────────────────────────────────────────────
// Helper: map Gateway status strings to our AgentStatus
// ──────────────────────────────────────────────

function mapAgentStatus(status?: string): AgentStatus {
  if (!status) return "idle";

  switch (status.toLowerCase()) {
    case "running":
    case "working":
    case "active":
    case "processing":
      return "working";
    case "collaborating":
    case "routing":
      return "collaborating";
    case "waiting":
    case "pending":
    case "approval":
      return "waiting";
    case "idle":
    case "ready":
    case "stopped":
    default:
      return "idle";
  }
}
