"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = variant === "danger";

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
            onClick={onCancel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Dialog */}
          <motion.div
            className="relative w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-950/95 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onCancel}
              className="absolute right-3 top-3 rounded-md p-1 text-slate-500 transition hover:text-slate-200"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Icon + Title */}
            <div className="mb-3 flex items-center gap-3">
              {isDanger && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                  <AlertTriangle className="h-4.5 w-4.5 text-red-400" />
                </div>
              )}
              <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
            </div>

            {/* Message */}
            <p className="mb-5 text-sm leading-relaxed text-slate-400">
              {message}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`rounded-lg border px-4 py-2 text-xs font-medium transition ${
                  isDanger
                    ? "border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:text-red-200"
                    : "border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
