"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toast notifications for the admin panel.
 *
 * Hand-rolled rather than a dependency, and built on a live region so
 * announcements reach assistive technology:
 *
 * - `role="status"` + `aria-live="polite"` for success and info, so a
 *   confirmation does not interrupt what the user is doing.
 * - `role="alert"` + `aria-live="assertive"` for errors, which do need to
 *   interrupt.
 *
 * Errors never auto-dismiss. A destructive action that failed must stay on
 * screen until the operator acknowledges it — auto-hiding an error is how a
 * failed send gets mistaken for a successful one.
 */

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  /** Milliseconds. 0 keeps it until dismissed. Errors default to 0. */
  duration: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (
    input: Omit<Toast, "id" | "duration"> & { duration?: number },
  ) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return context;
}

const DEFAULT_DURATIONS: Record<ToastVariant, number> = {
  success: 4_000,
  info: 5_000,
  warning: 8_000,
  // Never auto-dismiss a failure.
  error: 0,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback<ToastContextValue["toast"]>(
    (input) => {
      const id =
        globalThis.crypto?.randomUUID?.() ??
        `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const duration = input.duration ?? DEFAULT_DURATIONS[input.variant];
      setToasts((current) => [...current, { ...input, id, duration }]);

      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  // Clear pending timers on unmount so a dismissed provider cannot fire a
  // state update against an unmounted tree.
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = React.useMemo(
    () => ({ toasts, toast, dismiss }),
    [toasts, toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success:
    "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
  error: "border-destructive/40 bg-destructive/5 text-destructive",
  warning:
    "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  info: "border-border bg-card text-foreground",
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <>
      {/*
        Two separate live regions. A single region cannot be both polite and
        assertive, and switching an existing region's politeness is unreliable
        across screen readers.
      */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts
          .filter((item) => item.variant !== "error")
          .map((item) => (
            <ToastCard key={item.id} toast={item} onDismiss={onDismiss} />
          ))}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 top-20 z-100 flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts
          .filter((item) => item.variant === "error")
          .map((item) => (
            <ToastCard key={item.id} toast={item} onDismiss={onDismiss} />
          ))}
      </div>
    </>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const Icon = ICONS[toast.variant];

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-[var(--shadow-lift)] backdrop-blur",
        // `motion-safe` so the entrance animation is skipped for anyone who
        // has asked for reduced motion.
        "motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in",
        VARIANT_CLASSES[toast.variant],
      )}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed break-words">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 -m-1 rounded-lg p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <X aria-hidden="true" className="size-4" />
        <span className="sr-only">Dismiss notification</span>
      </button>
    </div>
  );
}
