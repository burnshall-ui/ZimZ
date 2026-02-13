"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarClock,
  Cpu,
  LayoutGrid,
  Map,
  Plus,
  Sparkles,
  TerminalSquare,
} from "lucide-react";
import AgentGrid from "@/src/components/AgentGrid";
import OfficeMap from "@/src/components/OfficeMap";
import AddAgentModal from "@/src/components/AddAgentModal";
import TasksView from "@/src/components/TasksView";
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
// Status legend for grid view
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

  // Mutable agent list – initialized from props (mock data or gateway)
  const [agents, setAgents] = useState<Agent[]>(initialAgents);

  // Add Agent modal state
  const [showAddModal, setShowAddModal] = useState(false);

  // ── Handlers ────────────────────────────────

  /** Add a new agent to the cluster (mirrors `openclaw agents add <id>`) */
  const handleAddAgent = (newAgent: Agent) => {
    setAgents((prev) => [...prev, newAgent]);
    setShowAddModal(false);
    // TODO: Send via Gateway WS → openclaw agents add
  };

  /** Remove an agent from the cluster (mirrors `openclaw agents delete <id>`) */
  const handleDeleteAgent = (agentId: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== agentId));
    // TODO: Send via Gateway WS → openclaw agents delete
  };

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

            {/* ── View Toggle (top-right in header) ── */}
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
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="mb-1 text-slate-400">Cluster Status</p>
              <p className="inline-flex items-center gap-2 font-medium text-emerald-300">
                <Cpu className="h-3.5 w-3.5" />
                Stable
              </p>
            </div>

            {/* ── Agents total card with Add/Remove buttons ── */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="mb-1 text-slate-400">Agents total</p>
              <div className="flex items-center justify-between">
                <p className="font-mono text-cyan-200">{agents.length}</p>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="group inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/20"
                    title="Add agent (openclaw agents add)"
                  >
                    <Plus className="h-3 w-3" />
                    <span className="hidden sm:inline">Add</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="mb-1 text-slate-400">Interface</p>
              <p className="inline-flex items-center gap-2 font-medium text-cyan-100">
                <TerminalSquare className="h-3.5 w-3.5" />
                Cyberpunk UI
              </p>
            </div>
          </div>
        </header>

        {/* ── CONTENT SECTION ──────────────────────── */}
        <section className="neon-panel rounded-2xl border border-slate-800 bg-slate-950/80 p-5 md:p-6">
          {/* Section header with dynamic title and legend */}
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

          {/* View content with smooth transition animation */}
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
