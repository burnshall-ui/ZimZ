"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  Play,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ConfirmDialog from "@/src/components/ConfirmDialog";
import type { Agent } from "@/src/types/agent";
import type {
  OpenClawCronAddParams,
  OpenClawCronUpdateParams,
  OpenClawSessionTarget,
  OpenClawWakeMode,
} from "@/src/types/cron";

interface TasksViewProps {
  agents: Agent[];
}

interface ScheduledTaskRecord {
  id: string;
  config: OpenClawCronAddParams;
  runState: "idle" | "queued";
  lastRun?: number | null;
  nextRun?: number | null;
  lastStatus?: string | null;
  lastError?: string | null;
}

interface TaskFormState {
  name: string;
  cronExpr: string;
  timezone: string;
  sessionTarget: OpenClawSessionTarget;
  wakeMode: OpenClawWakeMode;
  message: string;
  agentId: string;
}

interface ApiCronJobState {
  lastRunAtMs?: number | null;
  nextRunAtMs?: number | null;
  lastStatus?: string | null;
  lastError?: string | null;
}

interface ApiCronJob {
  id?: string;
  jobId?: string;
  name?: string;
  schedule?: OpenClawCronAddParams["schedule"];
  sessionTarget?: OpenClawCronAddParams["sessionTarget"];
  wakeMode?: OpenClawCronAddParams["wakeMode"];
  payload?: OpenClawCronAddParams["payload"];
  agentId?: string;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  delivery?: OpenClawCronAddParams["delivery"];
  state?: ApiCronJobState;
}

const cronIntervalPresets = [
  { label: "30min", expr: "*/30 * * * *" },
  { label: "1std", expr: "0 * * * *" },
  { label: "2std", expr: "0 */2 * * *" },
  { label: "6std", expr: "0 */6 * * *" },
  { label: "12std", expr: "0 */12 * * *" },
];

const toFormState = (task: ScheduledTaskRecord, fallbackAgentId: string): TaskFormState => ({
  name: task.config.name,
  cronExpr: task.config.schedule.kind === "cron" ? task.config.schedule.expr : "0 */6 * * *",
  timezone: task.config.schedule.kind === "cron" ? (task.config.schedule.tz ?? "") : "",
  sessionTarget: task.config.sessionTarget,
  wakeMode: task.config.wakeMode ?? "now",
  message:
    task.config.payload.kind === "systemEvent"
      ? task.config.payload.text
      : task.config.payload.message,
  agentId: task.config.agentId ?? fallbackAgentId,
});

const defaultFormState = (fallbackAgentId: string): TaskFormState => ({
  name: "",
  cronExpr: "",
  timezone: "Europe/Berlin",
  sessionTarget: "isolated",
  wakeMode: "next-heartbeat",
  message: "",
  agentId: fallbackAgentId,
});

const toCronConfig = (form: TaskFormState): OpenClawCronAddParams => {
  const isMain = form.sessionTarget === "main";
  return {
    name: form.name.trim(),
    schedule: {
      kind: "cron",
      expr: form.cronExpr.trim(),
      ...(form.timezone.trim() ? { tz: form.timezone.trim() } : {}),
    },
    sessionTarget: form.sessionTarget,
    wakeMode: form.wakeMode,
    payload: isMain
      ? { kind: "systemEvent", text: form.message.trim() }
      : { kind: "agentTurn", message: form.message.trim() },
    ...(form.agentId ? { agentId: form.agentId } : {}),
    enabled: true,
    ...(isMain ? {} : { delivery: { mode: "none" as const } }),
  };
};

const toTaskRecord = (job: ApiCronJob): ScheduledTaskRecord | null => {
  const id = job.jobId ?? job.id;
  if (!id || !job.name || !job.schedule || !job.sessionTarget || !job.payload) {
    return null;
  }

  return {
    id,
    config: {
      name: job.name,
      schedule: job.schedule,
      sessionTarget: job.sessionTarget,
      wakeMode: job.wakeMode ?? "now",
      payload: job.payload,
      ...(job.agentId ? { agentId: job.agentId } : {}),
      ...(job.description ? { description: job.description } : {}),
      ...(job.delivery ? { delivery: job.delivery } : {}),
      ...(job.deleteAfterRun !== undefined
        ? { deleteAfterRun: job.deleteAfterRun }
        : {}),
      enabled: job.enabled ?? true,
    },
    runState: "idle",
    lastRun: job.state?.lastRunAtMs ?? null,
    nextRun: job.state?.nextRunAtMs ?? null,
    lastStatus: job.state?.lastStatus ?? null,
    lastError: job.state?.lastError ?? null,
  };
};

const formatTs = (ms: number | null | undefined): string => {
  if (!ms) return "\u2014";
  const d = new Date(ms);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
};

const formatDelivery = (task: ScheduledTaskRecord): string | null => {
  const delivery = task.config.delivery;
  const mode = delivery?.mode;
  if (!mode || mode === "none") return null;
  const channel = (delivery as unknown as Record<string, unknown>)?.channel;
  const label = mode.charAt(0).toUpperCase() + mode.slice(1);
  return channel ? `${label} (${String(channel)})` : label;
};

export default function TasksView({ agents }: TasksViewProps) {
  const fallbackAgentId = agents[0]?.id ?? "";
  const [tasks, setTasks] = useState<ScheduledTaskRecord[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskToDeleteId, setTaskToDeleteId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<TaskFormState>(
    defaultFormState(fallbackAgentId),
  );
  const [editForm, setEditForm] = useState<TaskFormState>(
    defaultFormState(fallbackAgentId),
  );
  const [nextTaskNumber, setNextTaskNumber] = useState(1);
  const [createPresetValue, setCreatePresetValue] = useState("");

  const agentById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  );

  const updateCreateForm = (patch: Partial<TaskFormState>) => {
    setCreateForm((prev) => ({ ...prev, ...patch }));
  };

  const updateEditForm = (patch: Partial<TaskFormState>) => {
    setEditForm((prev) => ({ ...prev, ...patch }));
  };

  const loadCronJobs = useCallback(async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch("/api/cron/jobs", { cache: "no-store" });
      const data = (await response.json()) as { jobs?: ApiCronJob[]; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load cron jobs");
      }

      const mapped = (data.jobs ?? [])
        .map((job) => toTaskRecord(job))
        .filter((task): task is ScheduledTaskRecord => task !== null);

      setTasks(mapped);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load cron jobs";
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    void loadCronJobs();
  }, [loadCronJobs]);

  const formatSchedule = (task: ScheduledTaskRecord) => {
    if (task.config.schedule.kind === "cron") return task.config.schedule.expr;
    if (task.config.schedule.kind === "every") return `${task.config.schedule.everyMs}ms`;
    return task.config.schedule.at;
  };

  const formatPayloadText = (task: ScheduledTaskRecord) => {
    return task.config.payload.kind === "systemEvent"
      ? task.config.payload.text
      : task.config.payload.message;
  };

  const renderRuntimeInfo = (task: ScheduledTaskRecord) => {
    const delivery = formatDelivery(task);
    const hasRuntime = task.nextRun || task.lastRun || task.lastStatus;
    if (!hasRuntime && !delivery) return null;
    return (
      <div className="mt-1.5 space-y-0.5 border-t border-slate-800 pt-1.5 text-[11px] text-slate-500">
        {task.nextRun && (
          <p className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3 text-cyan-400/60" />
            Naechster Lauf: {formatTs(task.nextRun)}
          </p>
        )}
        {task.lastRun && (
          <p className="flex items-center gap-1">
            <Clock3 className="h-3 w-3 text-slate-500" />
            Letzter Lauf: {formatTs(task.lastRun)}
            {task.lastStatus && (
              <span
                className={
                  task.lastStatus === "error"
                    ? "ml-1 text-rose-400"
                    : "ml-1 text-emerald-400"
                }
              >
                ({task.lastStatus})
              </span>
            )}
          </p>
        )}
        {task.lastStatus === "error" && task.lastError && (
          <p className="flex items-center gap-1 text-rose-400/80">
            <AlertTriangle className="h-3 w-3" />
            <span className="line-clamp-1">{task.lastError}</span>
          </p>
        )}
        {delivery && (
          <p className="flex items-center gap-1">
            <Send className="h-3 w-3 text-cyan-400/50" />
            {delivery}
          </p>
        )}
      </div>
    );
  };

  const handleOpenCreate = () => {
    setEditingTaskId(null);
    setCreateForm(defaultFormState(fallbackAgentId));
    setCreatePresetValue("");
    setShowCreateModal(true);
  };

  const handleCreateTask = async () => {
    if (!createForm.name.trim() || !createForm.cronExpr.trim() || !createForm.message.trim()) {
      return;
    }

    const config = toCronConfig(createForm);
    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch("/api/cron/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = (await response.json()) as {
        job?: ApiCronJob;
        jobId?: string | null;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to create cron job");
      }

      const created =
        (data.job ? toTaskRecord(data.job) : null) ??
        ({
          id: data.jobId ?? `task-${nextTaskNumber}`,
          config,
          runState: "idle",
        } satisfies ScheduledTaskRecord);

      setTasks((prev) => [created, ...prev]);
      setNextTaskNumber((prev) => prev + 1);
      setShowCreateModal(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create cron job";
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenEdit = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    setShowCreateModal(false);
    setEditForm(toFormState(task, fallbackAgentId));
    setEditingTaskId(taskId);
  };

  const handleSaveEdit = async () => {
    if (!editingTaskId) return;
    if (!editForm.name.trim() || !editForm.cronExpr.trim() || !editForm.message.trim()) {
      return;
    }

    const existing = tasks.find((task) => task.id === editingTaskId);
    if (!existing) return;

    const patch: OpenClawCronUpdateParams["patch"] = {
      ...toCronConfig(editForm),
      enabled: existing.config.enabled,
    };

    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch(`/api/cron/jobs/${editingTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to update cron job");
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === editingTaskId
            ? {
                ...task,
                config: {
                  ...toCronConfig(editForm),
                  enabled: task.config.enabled,
                },
              }
            : task,
        ),
      );
      setEditingTaskId(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update cron job";
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleTask = async (taskId: string) => {
    const current = tasks.find((task) => task.id === taskId);
    if (!current) return;
    const nextEnabled = !current.config.enabled;

    const patchPayload: OpenClawCronUpdateParams = {
      jobId: taskId,
      patch: { enabled: nextEnabled },
    };

    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch(`/api/cron/jobs/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchPayload.patch),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to toggle cron job");
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                config: {
                  ...task.config,
                  enabled: nextEnabled,
                },
                runState: nextEnabled ? task.runState : "idle",
              }
            : task,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to toggle cron job";
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const runNow = async (taskId: string) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch(`/api/cron/jobs/${taskId}/run`, {
        method: "POST",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to run cron job");
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                config: { ...task.config, description: "run:force queued" },
                runState: "queued",
              }
            : task,
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run cron job";
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDeleteId) return;
    const removeId = taskToDeleteId;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const response = await fetch(`/api/cron/jobs/${removeId}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to delete cron job");
      }
      setTasks((prev) => prev.filter((task) => task.id !== removeId));
      setTaskToDeleteId(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete cron job";
      setSyncError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const sortedByName = (left: ScheduledTaskRecord, right: ScheduledTaskRecord) =>
    left.config.name.localeCompare(right.config.name);

  const activeTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.config.enabled && task.runState === "queued")
        .sort(sortedByName),
    [tasks],
  );
  const nextTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.config.enabled && task.runState !== "queued")
        .sort(sortedByName),
    [tasks],
  );
  const disabledTasks = useMemo(
    () => tasks.filter((task) => !task.config.enabled).sort(sortedByName),
    [tasks],
  );

  const renderTaskModal = ({
    open,
    title,
    form,
    onClose,
    onSubmit,
    onChange,
    submitLabel,
    mode,
  }: {
    open: boolean;
    title: string;
    form: TaskFormState;
    onClose: () => void;
    onSubmit: () => void;
    onChange: (patch: Partial<TaskFormState>) => void;
    submitLabel: string;
    mode: "create" | "edit";
  }) => (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute z-30 mt-3 w-full px-4 md:left-1/2 md:w-[26rem] md:-translate-x-1/2 md:px-0 lg:w-[42rem]"
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.97 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
        >
          <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-300/35 bg-slate-950/95 p-6 shadow-[0_14px_50px_rgba(4,12,28,0.85)] backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-cyan-300" />
                <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-700 bg-slate-900/70 p-1.5 text-slate-300 transition hover:border-cyan-300/45 hover:text-white"
                aria-label="Close task modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3">
              <label className="block text-xs text-slate-300">
                Task Name
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => onChange({ name: event.target.value })}
                  placeholder="Nightly status digest"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                />
                {mode === "create" && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Keep it short and clear so the task is instantly recognizable.
                  </p>
                )}
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-xs text-slate-300">
                  Cron Expression
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      value={form.cronExpr}
                      onChange={(event) => onChange({ cronExpr: event.target.value })}
                      placeholder="0 */6 * * *"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                    />
                    {mode === "create" && (
                      <select
                        value={createPresetValue}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setCreatePresetValue(nextValue);
                          if (!nextValue) return;
                          onChange({ cronExpr: nextValue });
                        }}
                        className="w-28 rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-2 text-xs text-slate-100 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                      >
                        <option value="">Preset</option>
                        {cronIntervalPresets.map((preset) => (
                          <option key={preset.expr} value={preset.expr}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {mode === "create" && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      Choose a preset or enter a custom cron expression.
                    </p>
                  )}
                </label>

                <label className="block text-xs text-slate-300">
                  Timezone
                  <input
                    type="text"
                    value={form.timezone}
                    onChange={(event) => onChange({ timezone: event.target.value })}
                    placeholder="Europe/Berlin"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                  />
                  {mode === "create" && (
                    <p className="mt-1 text-[10px] text-slate-500">
                      Use an IANA timezone, e.g. Europe/Berlin or UTC.
                    </p>
                  )}
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-xs text-slate-300">
                  Session Target
                  <select
                    value={form.sessionTarget}
                    onChange={(event) =>
                      onChange({ sessionTarget: event.target.value as OpenClawSessionTarget })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                  >
                    <option value="isolated">isolated</option>
                    <option value="main">main</option>
                  </select>
                </label>

                <label className="block text-xs text-slate-300">
                  Wake Mode
                  <select
                    value={form.wakeMode}
                    onChange={(event) =>
                      onChange({ wakeMode: event.target.value as OpenClawWakeMode })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                  >
                    <option value="next-heartbeat">next-heartbeat</option>
                    <option value="now">now</option>
                  </select>
                </label>

                <label className="block text-xs text-slate-300">
                  Agent
                  <select
                    value={form.agentId}
                    onChange={(event) => onChange({ agentId: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                  >
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-xs text-slate-300">
                {form.sessionTarget === "main" ? "System Event Text" : "Agent Turn Message"}
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(event) => onChange({ message: event.target.value })}
                  placeholder={
                    form.sessionTarget === "main"
                      ? "Reminder: check deployment logs."
                      : "Summarize overnight updates and critical alerts."
                  }
                  className="mt-1 w-full resize-none rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                />
                {mode === "create" && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    This text will be used by OpenClaw as the payload.
                  </p>
                )}
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/25"
              >
                <Plus className="h-3.5 w-3.5" />
                {submitLabel}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
          Scheduled Tasks
        </h3>
        <div className="flex items-center gap-2">
          {isSyncing && (
            <span className="text-[11px] text-cyan-300/90">Syncing...</span>
          )}
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/35 bg-cyan-500/12 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:border-cyan-400/50 hover:bg-cyan-500/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Task
          </button>
        </div>
      </div>

      {syncError && (
        <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {syncError}
        </div>
      )}

      {activeTasks.length > 0 && (
        <>
          <h4 className="pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200">
            Active Tasks
          </h4>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {activeTasks.map((task) => {
              const assignedAgent = task.config.agentId
                ? agentById.get(task.config.agentId)
                : null;
              const scheduleExpr = formatSchedule(task);
              const payloadText = formatPayloadText(task);

              return (
                <div
                  key={task.id}
                  className="rounded-xl border border-cyan-500/25 bg-slate-900/65 p-4 transition duration-200 hover:border-indigo-400/60 hover:shadow-[0_0_24px_rgba(99,102,241,0.2)] shadow-[0_0_18px_rgba(34,211,238,0.08)]"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{task.config.name}</p>
                      <p className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-cyan-300">
                        <Clock3 className="h-3 w-3" />
                        {scheduleExpr}
                      </p>
                    </div>
                    <span className="rounded-full border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-medium text-indigo-200">
                      Active
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <p>Agent: {assignedAgent?.name ?? task.config.agentId ?? "default"}</p>
                    <p>
                      {task.config.sessionTarget} | {task.config.wakeMode ?? "now"}
                    </p>
                    <p className="line-clamp-2 text-slate-500">{payloadText}</p>
                    {renderRuntimeInfo(task)}
                  </div>

                  <div className="mt-4 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => runNow(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-indigo-500/35 bg-indigo-500/12 px-2 py-1 text-[10px] font-medium text-indigo-200 transition hover:bg-indigo-500/20"
                    >
                      <Play className="h-3 w-3" />
                      Run
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/12 px-2 py-1 text-[10px] font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Enabled
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskToDeleteId(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/35 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 transition hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {nextTasks.length > 0 && (
        <>
          <h4 className="pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
            Next Tasks
          </h4>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {nextTasks.map((task) => {
              const assignedAgent = task.config.agentId
                ? agentById.get(task.config.agentId)
                : null;
              const scheduleExpr = formatSchedule(task);
              const payloadText = formatPayloadText(task);

              return (
                <div
                  key={task.id}
                  className="rounded-xl border border-cyan-500/25 bg-slate-900/65 p-4 transition duration-200 hover:border-cyan-300/65 hover:shadow-[0_0_24px_rgba(34,211,238,0.2)] shadow-[0_0_18px_rgba(34,211,238,0.08)]"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{task.config.name}</p>
                      <p className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-cyan-300">
                        <Clock3 className="h-3 w-3" />
                        {scheduleExpr}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                      Next
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-400">
                    <p>Agent: {assignedAgent?.name ?? task.config.agentId ?? "default"}</p>
                    <p>
                      {task.config.sessionTarget} | {task.config.wakeMode ?? "now"}
                    </p>
                    <p className="line-clamp-2 text-slate-500">{payloadText}</p>
                    {renderRuntimeInfo(task)}
                  </div>

                  <div className="mt-4 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => runNow(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-indigo-500/35 bg-indigo-500/12 px-2 py-1 text-[10px] font-medium text-indigo-200 transition hover:bg-indigo-500/20"
                    >
                      <Play className="h-3 w-3" />
                      Run
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/12 px-2 py-1 text-[10px] font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Enabled
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskToDeleteId(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/35 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 transition hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {disabledTasks.length > 0 && (
        <>
          <h4 className="pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Disabled Tasks
          </h4>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {disabledTasks.map((task) => {
              const assignedAgent = task.config.agentId
                ? agentById.get(task.config.agentId)
                : null;
              const scheduleExpr = formatSchedule(task);
              const payloadText = formatPayloadText(task);

              return (
                <div
                  key={task.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/45 p-4 transition duration-200 hover:border-slate-500/70 hover:shadow-[0_0_18px_rgba(148,163,184,0.14)]"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-300">{task.config.name}</p>
                      <p className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-slate-400">
                        <Clock3 className="h-3 w-3" />
                        {scheduleExpr}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                      Disabled
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-500">
                    <p>Agent: {assignedAgent?.name ?? task.config.agentId ?? "default"}</p>
                    <p>
                      {task.config.sessionTarget} | {task.config.wakeMode ?? "now"}
                    </p>
                    <p className="line-clamp-2">{payloadText}</p>
                    {renderRuntimeInfo(task)}
                  </div>

                  <div className="mt-4 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-[10px] font-medium text-slate-200 transition hover:bg-slate-700"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Enable
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskToDeleteId(task.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-red-500/35 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-300 transition hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tasks.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
          <CalendarClock className="mx-auto mb-2 h-5 w-5 text-slate-500" />
          <p className="text-sm text-slate-300">Noch keine Tasks vorhanden.</p>
          <p className="mt-1 text-xs text-slate-500">
            Erstelle die erste Cron-Task ueber den Button oben rechts.
          </p>
        </div>
      )}

      {renderTaskModal({
        open: showCreateModal,
        title: "Create Cron Task",
        form: createForm,
        onClose: () => setShowCreateModal(false),
        onSubmit: handleCreateTask,
        onChange: updateCreateForm,
        submitLabel: "Create Task",
        mode: "create",
      })}

      {renderTaskModal({
        open: Boolean(editingTaskId),
        title: "Edit Cron Task",
        form: editForm,
        onClose: () => setEditingTaskId(null),
        onSubmit: handleSaveEdit,
        onChange: updateEditForm,
        submitLabel: "Save Changes",
        mode: "edit",
      })}

      <ConfirmDialog
        open={Boolean(taskToDeleteId)}
        title="Delete Task"
        message="Willst du diese Task wirklich loeschen? Dieser Schritt kann nicht rueckgaengig gemacht werden."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteTask}
        onCancel={() => setTaskToDeleteId(null)}
      />
    </div>
  );
}
