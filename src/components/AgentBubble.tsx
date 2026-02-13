"use client";

import { motion } from "framer-motion";
import { BookOpen, Brain, Info, Save, Settings2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import type { Agent } from "@/src/types/agent";

type BubbleTab = "info" | "settings";

// Sub-tabs in the Settings area: SOUL.md vs MEMORY.md
type SettingsFile = "soul" | "memory";

interface AgentBubbleProps {
  agent: Agent;
  onClose: () => void;
  onDelete?: (agentId: string) => void;
}

export default function AgentBubble({ agent, onClose, onDelete }: AgentBubbleProps) {
  const [activeTab, setActiveTab] = useState<BubbleTab>("info");
  const [activeFile, setActiveFile] = useState<SettingsFile>("soul");

  // Local copies of workspace files (persisted via Gateway WS later)
  const [soulMd, setSoulMd] = useState(agent.soulMd);
  const [memoryMd, setMemoryMd] = useState(agent.memoryMd);

  // Dirty state: indicates whether user has unsaved changes
  const soulDirty = soulMd !== agent.soulMd;
  const memoryDirty = memoryMd !== agent.memoryMd;
  const hasDirtyChanges = soulDirty || memoryDirty;

  // Delete confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Placeholder for Gateway integration
  const handleSave = () => {
    // TODO: Write via Gateway WebSocket to agent workspace
    // e.g. exec tool: write SOUL.md / MEMORY.md in workspace
    console.log(`[${agent.id}] Save:`, { soulMd, memoryMd });
  };

  // Delete handler with confirmation
  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    onDelete?.(agent.id);
    onClose();
    // TODO: Send via Gateway WS → openclaw agents delete <id>
  };

  // ── Viewport clamping ──────────────────────────
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [leftOffset, setLeftOffset] = useState<number | null>(null);

  const clampToViewport = useCallback(() => {
    const el = bubbleRef.current;
    if (!el) return;

    if (window.innerWidth < 768) {
      setLeftOffset(null);
      return;
    }

    const parent = el.offsetParent as HTMLElement | null;
    if (!parent) return;

    const parentRect = parent.getBoundingClientRect();
    const bubbleWidth = 416; // 26rem = 416px
    const viewportWidth = window.innerWidth;
    const padding = 16;

    const parentCenter = parentRect.left + parentRect.width / 2;
    let idealLeft = parentCenter - bubbleWidth / 2;

    idealLeft = Math.max(padding, idealLeft);
    idealLeft = Math.min(viewportWidth - bubbleWidth - padding, idealLeft);

    setLeftOffset(idealLeft - parentRect.left);
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      clampToViewport();
    });

    window.addEventListener("resize", clampToViewport);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", clampToViewport);
    };
  }, [clampToViewport]);

  const positionStyle = leftOffset !== null
    ? { left: `${leftOffset}px` }
    : undefined;

  const positionClasses = leftOffset !== null
    ? "absolute z-30 mt-3 md:w-[26rem]"
    : "absolute z-30 mt-3 w-full md:left-1/2 md:w-[26rem] md:-translate-x-1/2";

  return (
    <>
      <motion.div
        ref={bubbleRef}
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        style={positionStyle}
        className={`rounded-2xl border border-cyan-300/35 bg-slate-950/95 p-4 shadow-[0_14px_50px_rgba(4,12,28,0.85)] backdrop-blur ${positionClasses}`}
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-cyan-200">{agent.name}</p>
            <p className="font-mono text-[10px] text-slate-500">{agent.modelType}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-700 bg-slate-900/70 p-1.5 text-slate-300 transition hover:border-cyan-300/45 hover:text-white"
            aria-label="Close bubble"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Main tabs: Info / Settings */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-900/70 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
              activeTab === "info"
                ? "bg-cyan-500/20 text-cyan-200"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            <Info className="h-3.5 w-3.5" />
            Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`relative inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
              activeTab === "settings"
                ? "bg-cyan-500/20 text-cyan-200"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Settings
            {hasDirtyChanges && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
            )}
          </button>
        </div>

        {/* ── INFO TAB ──────────────────────────── */}
        {activeTab === "info" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
              <p className="mb-1 text-xs uppercase tracking-widest text-slate-500">
                Current Task
              </p>
              <p className="text-sm text-slate-200">{agent.currentTask}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-black/70 p-3">
              <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">
                Agent Log
              </p>
              <div className="terminal-scroll max-h-32 space-y-1 overflow-y-auto pr-2 font-mono text-xs text-emerald-300/90">
                {agent.logs.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── SETTINGS TAB ─────────────────────── */
          <div className="space-y-3">
            {/* File tabs: SOUL.md / MEMORY.md */}
            <div className="flex items-center gap-1 rounded-lg bg-slate-900/60 p-1">
              <button
                type="button"
                onClick={() => setActiveFile("soul")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  activeFile === "soul"
                    ? "bg-violet-500/20 text-violet-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Brain className="h-3 w-3" />
                SOUL.md
                {soulDirty && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveFile("memory")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  activeFile === "memory"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <BookOpen className="h-3 w-3" />
                MEMORY.md
                {memoryDirty && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            </div>

            {/* Markdown editor for the active file */}
            {activeFile === "soul" ? (
              <div>
                <label
                  htmlFor={`soul-${agent.id}`}
                  className="mb-1.5 block text-[10px] text-slate-500"
                >
                  Agent persona, boundaries and tone
                </label>
                <textarea
                  id={`soul-${agent.id}`}
                  value={soulMd}
                  onChange={(e) => setSoulMd(e.target.value)}
                  rows={7}
                  placeholder="# Agent Soul..."
                  className="terminal-scroll w-full rounded-xl border border-violet-500/25 bg-slate-900/80 p-2.5 font-mono text-xs leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-violet-400/50"
                  spellCheck={false}
                />
              </div>
            ) : (
              <div>
                <label
                  htmlFor={`memory-${agent.id}`}
                  className="mb-1.5 block text-[10px] text-slate-500"
                >
                  Long-term memory and curated notes
                </label>
                <textarea
                  id={`memory-${agent.id}`}
                  value={memoryMd}
                  onChange={(e) => setMemoryMd(e.target.value)}
                  rows={7}
                  placeholder="# Memory..."
                  className="terminal-scroll w-full rounded-xl border border-emerald-500/25 bg-slate-900/80 p-2.5 font-mono text-xs leading-relaxed text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50"
                  spellCheck={false}
                />
              </div>
            )}

            {/* Save button (visible only when there are unsaved changes) */}
            {hasDirtyChanges && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={handleSave}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/15 px-4 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/25"
              >
                <Save className="h-3.5 w-3.5" />
                Save changes
              </motion.button>
            )}

            {/* ── Danger Zone: Delete Agent ─────── */}
            {onDelete && (
              <div className="mt-2 border-t border-slate-800 pt-3">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-slate-600">
                  Danger Zone
                </p>
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-400 transition hover:border-red-400/50 hover:bg-red-500/20 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Agent
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Delete Confirmation Dialog ─────────── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Agent"
        message={`Are you sure you want to permanently delete "${agent.name}" (${agent.id})? This will remove the agent's workspace, sessions, and all associated data. This action cannot be undone.`}
        confirmLabel="Delete Agent"
        cancelLabel="Keep Agent"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
}
