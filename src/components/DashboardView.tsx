"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  LayoutGrid,
  Map,
  Sparkles,
  TerminalSquare,
  Wifi,
  WifiOff,
} from "lucide-react";
import AgentGrid from "@/src/components/AgentGrid";
import OfficeMap from "@/src/components/OfficeMap";
import AddAgentModal from "@/src/components/AddAgentModal";
import TasksView from "@/src/components/TasksView";
import { useGatewayEvents } from "@/src/hooks/useGatewayEvents";
import type { Agent } from "@/src/types/agent";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

type ViewMode = "grid" | "map" | "tasks";

interface DashboardViewProps {
  agents: Agent[];
}

// ──────────────────────────────────────────────
// Toggle config
// ──────────────────────────────────────────────

const viewTabs: { id: ViewMode; label: string; Icon: typeof LayoutGrid }[] = [
  { id: "grid", label: "List View", Icon: LayoutGrid },
  { id: "map", label: "Live Map", Icon: Map },
  { id: "tasks", label: "Tasks", Icon: CalendarClock },
];

// ──────────────────────────────────────────────
// Status legend
// ──────────────────────────────────────────────

const statusLegend = [
  { label: "Working", color: "bg-emerald-400", glow: "shadow-[0_0_8px_rgba(16,185,129,0.7)]" },
  { label: "Collaborating", color: "bg-violet-400", glow: "shadow-[0_0_8px_rgba(139,92,246,0.7)]" },
  { label: "Waiting", color: "bg-amber-300", glow: "shadow-[0_0_8px_rgba(245,158,11,0.6)]" },
  { label: "Idle", color: "bg-slate-400", glow: "shadow-[0_0_8px_rgba(148,163,184,0.5)]" },
];

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

export default function DashboardView({ agents: initialAgents }: DashboardViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [showAddModal, setShowAddModal] = useState(false);

  // Live Gateway events
  const { gatewayConnected, getAgentUpdate } = useGatewayEvents();

  // ── Apply live status updates to agents ────
  useEffect(() => {
    setAgents((prev) =>
      prev.map((agent) => {
        const update = getAgentUpdate(agent.id);
        if (!update) return agent;

        const updatedAgent = { ...agent };
        if (update.status) updatedAgent.status = update.status;
        if (update.task) updatedAgent.currentTask = update.task;
        if (update.log) {
          updatedAgent.logs = [...agent.logs.slice(-49), update.log];
        }
        return updatedAgent;
      }),
    );
  }, [getAgentUpdate]);

  // ── Periodic agent list refresh (every 30s) ────
  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/agents");
        if (!res.ok) return;
        const data = await res.json();
        if (data.agents && Array.isArray(data.agents)) {
          setAgents((prev) => {
            // Merge: keep live status from existing agents
            const existingById: Record<string, Agent> = {};
            for (const a of prev) existingById[a.id] = a;
            return data.agents.map((fresh: Agent) => {
              const existing = existingById[fresh.id];
              if (existing) {
                return {
                  ...fresh,
                  status: existing.status,
                  currentTask: existing.currentTask,
                  logs: existing.logs,
                };
              }
              return fresh;
            });
          });
        }
      } catch {
        // Silent fail – don't break the dashboard
      }
    };

    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Add agent via Gateway RPC ────────────────
  const handleAddAgent = useCallback(async (newAgent: Agent) => {
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newAgent.id,
          name: newAgent.name,
          model: newAgent.modelType,
          identity: { name: newAgent.name },
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to add agent");
      }

      // Add to local state
      setAgents((prev) => [...prev, newAgent]);
      setShowAddModal(false);
    } catch (error) {
      console.error("Failed to add agent:", error);
      alert(error instanceof Error ? error.message : "Failed to create agent");
    }
  }, []);

  // ── Delete agent via Gateway RPC ─────────────
  const handleDeleteAgent = useCallback(async (agentId: string) => {
    try {
      const response = await fetch(`/api/agents/${agentId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        throw new Error(result.error || "Failed to delete agent");
      }

      setAgents((prev) => prev.filter((a) => a.id !== agentId));
    } catch (error) {
      console.error("Failed to delete agent:", error);
      alert(error instanceof Error ? error.message : "Failed to delete agent");
    }
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-slate-950 text-slate-100">
      {/* Background effects */}
      <div className="cyber-grid-bg pointer-events-none absolute inset-0" />
      <div className="scanline-overlay pointer-events-none absolute inset-0 opacity-40" />

      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 md:px-10">
        {/* ── HEADER ───────────────────────────────── */}
        <header className="neon-panel rounded-2xl border border-cyan-300/30 p-6 shadow-[0_0_45px_rgba(8,145,178,0.2)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs font-medium tracking-wide text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                ZIMZ Agent Control
              </div>
              <h1 className="mb-2 font-[family-name:var(--font-orbitron)] text-3xl font-black uppercase tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-100 to-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.4)] md:text-4xl">
                ZIMZ
              </h1>
            </div>

            {/* ── View Toggle ── */}
            <div className="flex shrink-0 items-center rounded-xl border border-slate-700 bg-slate-900/80 p-1">
              {viewTabs.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewMode(id)}
                  className={`relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                    viewMode === id
                      ? "text-cyan-200"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {viewMode === id && (
                    <motion.span
                      layoutId="view-toggle-indicator"
                      className="absolute inset-0 rounded-lg border border-cyan-500/30 bg-cyan-500/15"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                  <Icon className="relative h-3.5 w-3.5" />
                  <span className="relative hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="max-w-2xl text-sm text-slate-300 md:text-base">
            Monitor active and waiting agents, inspect logs in real-time, and
            adjust core prompt parameters directly per agent.
          </p>

          {/* Cluster status cards */}
          <div className="mt-5 grid gap-3 text-xs text-slate-300 md:grid-cols-3">
            {/* Gateway Connection Status */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="mb-1 text-slate-400">Gateway Status</p>
              <p
                className={`inline-flex items-center gap-2 font-medium ${
                  gatewayConnected ? "text-emerald-300" : "text-red-400"
                }`}
              >
                {gatewayConnected ? (
                  <>
                    <Wifi className="h-3.5 w-3.5" />
                    Connected
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5" />
                    Disconnected
                  </>
                )}
              </p>
            </div>

            {/* Agents total */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="mb-1 text-slate-400">Agents total</p>
              {/* ToDo# Header-Add-Button bleibt absichtlich ausgeblendet; Add-Logik bleibt im Code erhalten. */}
              <p className="font-mono text-cyan-200">{agents.length}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="mb-1 text-slate-400">Interface</p>
              <p className="inline-flex items-center gap-2 font-medium text-cyan-100">
                <TerminalSquare className="h-3.5 w-3.5" />
                Gateway RPC
              </p>
            </div>
          </div>
        </header>

        {/* ── CONTENT SECTION ──────────────────────── */}
        <section className="neon-panel rounded-2xl border border-slate-800 bg-slate-950/80 p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
              {viewMode === "grid"
                ? "Agent Grid"
                : viewMode === "map"
                  ? "Office Map"
                  : "Task Scheduler"}
            </h2>

            {viewMode === "grid" ? (
              <div className="hidden items-center gap-3 text-xs text-slate-400 sm:inline-flex">
                {statusLegend.map(({ label, color, glow }) => (
                  <span key={label} className="inline-flex items-center gap-1">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${color} ${glow}`}
                    />
                    {label}
                  </span>
                ))}
              </div>
            ) : viewMode === "map" ? (
              <p className="text-xs text-slate-500">
                Real-time positions based on agent status
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Create recurring jobs and assign them to agents
              </p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {viewMode === "grid" ? (
              <motion.div
                key="grid-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <AgentGrid agents={agents} onDeleteAgent={handleDeleteAgent} />
              </motion.div>
            ) : viewMode === "map" ? (
              <motion.div
                key="map-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <OfficeMap agents={agents} onDeleteAgent={handleDeleteAgent} />
              </motion.div>
            ) : (
              <motion.div
                key="tasks-view"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <TasksView agents={agents} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      {/* ── Add Agent Modal ──────────────────────── */}
      <AddAgentModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddAgent}
        existingIds={agents.map((a) => a.id)}
      />
    </div>
  );
}
