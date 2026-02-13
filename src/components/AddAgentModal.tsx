"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bot, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Agent, AgentStatus } from "@/src/types/agent";

// Common model presets (from OpenClaw provider docs)
const modelPresets = [
  "anthropic/claude-sonnet-4-5",
  "anthropic/claude-opus-4-6",
  "openai/o4-mini",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
];

interface AddAgentModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (agent: Agent) => void;
  existingIds: string[];
}

export default function AddAgentModal({
  open,
  onClose,
  onAdd,
  existingIds,
}: AddAgentModalProps) {
  const [agentId, setAgentId] = useState("");
  const [name, setName] = useState("");
  const [modelType, setModelType] = useState(modelPresets[0]);
  const [customModel, setCustomModel] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [initialTask, setInitialTask] = useState("");

  // Validation
  const trimmedId = agentId.trim().toLowerCase().replace(/\s+/g, "-");
  const idConflict = existingIds.includes(trimmedId);
  const isValid = trimmedId.length > 0 && name.trim().length > 0 && !idConflict;

  const handleSubmit = () => {
    if (!isValid) return;

    const newAgent: Agent = {
      id: trimmedId,
      name: name.trim(),
      status: "idle" as AgentStatus,
      currentTask: initialTask.trim() || "Awaiting first task assignment",
      modelType: useCustomModel ? customModel.trim() : modelType,
      logs: [
        `[${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}] agent registered via ZIMZ dashboard`,
      ],
      soulMd: `# ${name.trim()}\n\nNew agent created via ZIMZ Agent Control.\n\n## Role\n- Define this agent's purpose and boundaries\n\n## Rules\n- No destructive actions without confirmation`,
      memoryMd: `# Memory\n\n## ${new Date().toISOString().slice(0, 10)}\n- Agent created`,
    };

    onAdd(newAgent);
    resetForm();
  };

  const resetForm = () => {
    setAgentId("");
    setName("");
    setModelType(modelPresets[0]);
    setCustomModel("");
    setUseCustomModel(false);
    setInitialTask("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md rounded-2xl border border-cyan-300/30 bg-slate-950/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(8,145,178,0.12)]"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10">
                  <Bot className="h-4 w-4 text-cyan-300" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Add Agent
                  </h2>
                  <p className="text-[10px] text-slate-500">
                    Register a new agent in the cluster
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-slate-700 bg-slate-900/70 p-1.5 text-slate-400 transition hover:border-slate-500 hover:text-white"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Agent ID */}
              <div>
                <label
                  htmlFor="agent-id"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  Agent ID
                  <span className="ml-1 text-red-400">*</span>
                </label>
                <input
                  id="agent-id"
                  type="text"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="e.g. monitor-alpha"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 font-mono text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
                  spellCheck={false}
                />
                {idConflict && (
                  <p className="mt-1 text-[10px] text-red-400">
                    An agent with this ID already exists.
                  </p>
                )}
                {trimmedId && !idConflict && (
                  <p className="mt-1 text-[10px] text-slate-600">
                    Workspace: ~/.openclaw/workspace-{trimmedId}
                  </p>
                )}
              </div>

              {/* Display Name */}
              <div>
                <label
                  htmlFor="agent-name"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  Display Name
                  <span className="ml-1 text-red-400">*</span>
                </label>
                <input
                  id="agent-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Monitor Alpha"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
                />
              </div>

              {/* Model Type */}
              <div>
                <label
                  htmlFor="agent-model"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  Model
                </label>
                {!useCustomModel ? (
                  <div className="flex gap-2">
                    <select
                      id="agent-model"
                      value={modelType}
                      onChange={(e) => setModelType(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 font-mono text-xs text-slate-200 outline-none transition focus:border-cyan-400/50"
                    >
                      {modelPresets.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setUseCustomModel(true)}
                      className="shrink-0 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-[10px] text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
                    >
                      Custom
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      id="agent-model"
                      type="text"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      placeholder="provider/model-name"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 font-mono text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setUseCustomModel(false);
                        setCustomModel("");
                      }}
                      className="shrink-0 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-[10px] text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
                    >
                      Preset
                    </button>
                  </div>
                )}
              </div>

              {/* Initial Task */}
              <div>
                <label
                  htmlFor="agent-task"
                  className="mb-1.5 block text-xs font-medium text-slate-400"
                >
                  Initial Task
                  <span className="ml-1 text-slate-600">(optional)</span>
                </label>
                <input
                  id="agent-task"
                  type="text"
                  value={initialTask}
                  onChange={(e) => setInitialTask(e.target.value)}
                  placeholder="e.g. Monitor API response times"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-cyan-400/50"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isValid}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Agent
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
