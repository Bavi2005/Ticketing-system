import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export { AnimatePresence };

/* ---------------- Status Badge ---------------- */
const STATUS_STYLES = {
  PENDING: 'bg-amber-100 text-amber-700 ring-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-700 ring-rose-200',
  active: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  redeemed: 'bg-gray-100 text-gray-600 ring-gray-200',
  expired: 'bg-rose-100 text-rose-700 ring-rose-200',
};

export function Badge({ status, children }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600 ring-gray-200';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style}`}
    >
      {children}
    </span>
  );
}

/* ---------------- Empty State ---------------- */
export function EmptyState({ icon = '📭', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white px-8 py-24 text-center dark:border-slate-700 dark:bg-slate-800/60">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 text-4xl shadow-inner dark:from-indigo-500/10 dark:to-violet-500/10">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-gray-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

/* ---------------- Page Header ---------------- */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-gray-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ---------------- Toast System ---------------- */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const activeRef = useRef(new Set());

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (type, title, description) => {
      const key = `${type}::${title}::${description}`;

      // Skip duplicate active toasts so a looping effect only ever shows one.
      if (activeRef.current.has(key)) return;

      const id = Math.random().toString(36).slice(2);
      activeRef.current.add(key);
      setToasts((t) => [...t, { id, type, title, description }]);
      setTimeout(() => {
        activeRef.current.delete(key);
        dismiss(id);
      }, 5000);
    },
    [dismiss]
  );

  const success = useCallback((title, description) => toast('success', title, description), [toast]);
  const error = useCallback((title, description) => toast('error', title, description), [toast]);
  const info = useCallback((title, description) => toast('info', title, description), [toast]);

  const value = useMemo(
    () => ({ toast, success, error, info }),
    [toast, success, error, info]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div role="region" aria-label="Notifications" aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3.5 shadow-lg ring-1 ${
                t.type === 'success'
                  ? 'bg-emerald-600 text-white ring-emerald-700'
                  : t.type === 'error'
                  ? 'bg-rose-600 text-white ring-rose-700'
                  : 'bg-gray-900 text-white ring-gray-800'
              }`}
              role="status"
            >
              <span className="text-lg leading-none mt-0.5" aria-hidden="true">
                {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[13px] text-white/80">{t.description}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="ml-auto shrink-0 text-white/70 hover:text-white" aria-label="Dismiss">
                ✕
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { success() {}, error() {}, info() {} };
  return ctx;
}

/* ---------------- Modal (accessible) ---------------- */
export function Modal({ open, onClose, title, children, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === 'string' ? title : undefined}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" aria-hidden="true" />
      <div ref={ref} tabIndex={-1} className={`card relative w-full max-w-md rounded-2xl p-6 ${className}`}>
        {title && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close dialog"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-700">
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ---------------- Progress bar ---------------- */
export function ProgressBar({ value = 0, className = '', tone = 'brand' }) {
  const pct = Math.max(0, Math.min(100, value));
  const gradients = {
    brand: 'from-indigo-500 to-violet-500',
    gold: 'from-amber-400 to-orange-500',
    success: 'from-emerald-400 to-teal-500',
  };
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={`h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700/60 ${className}`}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full rounded-full bg-gradient-to-r ${gradients[tone] || gradients.brand}`}
      />
    </div>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name = '', className = '' }) {
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white ring-2 ring-indigo-100 dark:ring-slate-700 ${className}`}>
      {(name || 'U').charAt(0).toUpperCase()}
    </div>
  );
}

/* ---------------- Skeleton Loader ---------------- */
export function SkeletonLoader({ width = '100%', height = '16px', radius = '4px', count = 1, className = '' }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-200 dark:bg-gray-700 animate-pulse"
          style={{ width, height, borderRadius: radius }}
        />
      ))}
    </div>
  );
}

/* ---------------- Form primitives ---------------- */
export const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 text-[15px] text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:placeholder-slate-500 dark:focus:bg-slate-800 dark:focus:ring-indigo-500/20';

export const labelCls = 'mb-2 block text-[13px] font-semibold text-gray-700 dark:text-slate-300';

export const btnPrimaryCls =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-600/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none';

export const btnSmPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-600/40 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none';

export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-200/60 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus:ring-slate-700';

export function Field({ id, label, error, className = '', ...props }) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <input
        id={id}
        {...props}
        className={`${inputCls} ${
          error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/10 dark:border-rose-500/40' : ''
        }`}
      />
      {error && <p className="mt-1.5 text-[13px] font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

export function Button({ loading = false, loadingText = 'Please wait…', className = '', ...props }) {
  return (
    <button disabled={props.disabled || loading} {...props} className={`${btnPrimaryCls} ${className}`}>
      {loading ? loadingText : props.children}
    </button>
  );
}

export function Alert({ children }) {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
      <span aria-hidden="true">⚠</span>
      <p>{children}</p>
    </div>
  );
}