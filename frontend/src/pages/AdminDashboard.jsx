import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, CheckCircle2, XCircle, Gift, ArrowRight, ReceiptText, ShieldCheck } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { useToast, SkeletonLoader, Badge } from '../components/ui';
import { Logo } from '../components/Navbar';
import { formatCurrency, formatDateTime } from '../utils/formatters';

const STAT_CARDS = [
  { label: 'Pending review', key: 'pendingReceipts', icon: ClipboardList, tint: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
  { label: 'Approved', key: 'approvedReceipts', icon: CheckCircle2, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  { label: 'Rejected', key: 'rejectedReceipts', icon: XCircle, tint: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
  { label: 'Vouchers issued', key: 'vouchersIssued', icon: Gift, tint: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400' },
];

export default function AdminDashboard() {
  const { admin, stats, receipts, adminLoading, error, fetchStats, fetchReceipts } = useAdmin();
  const { error: toastError } = useToast();

  useEffect(() => {
    if (admin) {
      fetchStats();
      fetchReceipts();
    }
  }, [admin, fetchStats, fetchReceipts]);

  useEffect(() => {
    if (error) toastError(error);
  }, [error, toastError]);

  const receiptList = useMemo(() => {
    const list = Array.isArray(receipts) ? receipts : receipts?.receipts;
    return (list || []).slice(0, 5);
  }, [receipts]);

  if (!admin || adminLoading) {
    return (
      <div className="space-y-7 lg:space-y-10">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Admin overview
          </h2>
          <p className="mt-2 text-[15px] text-gray-500 dark:text-slate-400">Loading the admin data…</p>
        </div>
        <SkeletonLoader height="160px" className="rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {[0, 1, 2, 3].map((i) => <SkeletonLoader key={i} height="110px" className="rounded-2xl" />)}
        </div>
        <SkeletonLoader height="220px" className="rounded-2xl" />
      </div>
    );
  }

  const pending = stats?.pendingReceipts || 0;
  const approved = stats?.approvedReceipts || 0;
  const issued = stats?.vouchersIssued || 0;

  return (
    <div className="space-y-7 lg:space-y-10">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          Welcome back, {admin?.name?.split(' ')[0] || 'Admin'}
        </h1>
        <p className="mt-2 text-[15px] text-gray-500 dark:text-slate-400">
          {pending > 0
            ? <>You have <span className="font-semibold text-amber-600 dark:text-amber-400">{pending} receipt{pending === 1 ? '' : 's'}</span> awaiting review.</>
            : 'No pending receipts — you are all caught up.'}
        </p>
      </div>

      <div className="grid gap-6 lg:gap-8 lg:grid-cols-5">
        {/* Review queue card */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-[#0F172A] p-6 text-white shadow-xl shadow-indigo-900/20 ring-1 ring-indigo-400/20 sm:p-8 lg:col-span-3"
        >
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:24px_24px]" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="text-sm font-semibold tracking-wide text-white/90">LoyaltyPro</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-100 ring-1 ring-white/20">
              <ShieldCheck className="h-3.5 w-3.5" /> Admin console
            </span>
          </div>

          <div className="relative mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200/80">Review queue</p>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-5xl font-extrabold tracking-tight">{pending}</p>
              <p className="mb-1.5 text-sm font-medium text-indigo-200/80">receipts pending</p>
            </div>
          </div>

          <div className="relative mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/admin/receipts"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <ClipboardList className="h-4 w-4" />
              Review receipts
            </Link>
            <span className="text-sm text-indigo-100/90">
              {approved} approved · {issued} voucher{issued === 1 ? '' : 's'} issued
            </span>
          </div>
        </motion.section>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          {STAT_CARDS.map((s, i) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 + i * 0.05 }}
              className="card rounded-2xl p-5 sm:p-6"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.tint}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <p className="mt-3 text-2xl font-extrabold tabular-nums tracking-tight text-gray-900 dark:text-white">{stats?.[s.key] || 0}</p>
              <p className="text-[12px] font-medium text-gray-500 dark:text-slate-400">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent receipts */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="card rounded-2xl p-6 sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent receipts</h2>
          <Link to="/admin/receipts" className="group inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            View all
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {receiptList.length === 0 ? (
          <div className="rounded-xl bg-gray-50 px-6 py-10 text-center dark:bg-slate-800/60">
            <p className="text-sm font-medium text-gray-600 dark:text-slate-300">No receipts yet</p>
            <p className="mt-1 text-sm text-gray-400 dark:text-slate-500">New submissions will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700/60">
            {receiptList.map((r) => (
              <li key={r.id} className="flex items-center gap-4 py-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <ReceiptText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900 dark:text-white">{r.orderId}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {r.user?.name || r.user?.email} · {formatDateTime(r.submittedAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums text-gray-900 dark:text-white">{formatCurrency(r.amount)}</p>
                  <Badge status={r.status}>{r.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </div>
  );
}