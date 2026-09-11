import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Search } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useToast, PageHeader, Badge, SkeletonLoader, EmptyState, btnSmPrimary } from '../components/ui';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import { uploadUrl } from '../api';

const STATUS_META = {
  PENDING: { label: 'Under review', tone: 'amber' },
  APPROVED: { label: 'Rewarded', tone: 'emerald' },
  REJECTED: { label: 'Rejected', tone: 'rose' },
};

export default function ReceiptHistory() {
  const { receipts, loading, error, fetchReceipts } = useUser();
  const { error: toastError } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);
  useEffect(() => { if (error) toastError('Receipts', error); }, [error, toastError]);

  const filtered = useMemo(() => {
    let list = receipts || [];
    if (filter !== 'ALL') list = list.filter((r) => r.status === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        r.orderId.toLowerCase().includes(q) ||
        String(r.amount).includes(q)
      );
    }
    return list;
  }, [receipts, filter, query]);

  return (
    <div>
      <PageHeader
        title="Receipt history"
        subtitle="All your submissions — rewards, statuses, and dates in one place."
        action={
          <button className={btnSmPrimary} onClick={() => navigate('/upload-receipt')}>
            New receipt
          </button>
        }
      />

      {/* Filter bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order ID or amount…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:placeholder-slate-500"
          />
        </div>
        <div className="inline-flex rounded-xl bg-gray-100 p-1 ring-1 ring-gray-200/60 dark:bg-slate-800/60 dark:ring-slate-700/50">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                filter === s
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-900 dark:text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <SkeletonLoader key={i} height="84px" className="rounded-2xl" />)}
        </div>
      ) : (receipts || []).length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No receipts yet"
          description="Submit your first purchase receipt and we'll start tracking your rewards."
          action={<button className={btnSmPrimary} onClick={() => navigate('/upload-receipt')}>Upload a receipt</button>}
        />
      ) : filtered.length === 0 ? (
        <div className="card rounded-2xl px-6 py-14 text-center">
          <p className="font-medium text-gray-700 dark:text-slate-300">Nothing matches</p>
          <p className="mt-1 text-sm text-gray-400 dark:text-slate-500">Try clearing the search or picking a different status.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden rounded-2xl md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-400">
                  <th className="px-5 py-3.5">Receipt</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Reward</th>
                  <th className="px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status] || { label: r.status, tone: 'gray' };
                  return (
                    <ReceiptRowDesktop key={r.id} receipt={r} meta={meta} />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {filtered.map((r) => {
              const meta = STATUS_META[r.status] || { label: r.status, tone: 'gray' };
              return (
                <ReceiptCard key={r.id} receipt={r} meta={meta} />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ReceiptRowDesktop({ receipt: r, meta }) {
  const img = uploadUrl(r.imageUrl);
  return (
    <tr className="group transition hover:bg-gray-50/60 dark:hover:bg-slate-800/40">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3.5">
          <Thumb src={img} />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{r.orderId}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(r.submittedAt)}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 text-gray-600 dark:text-slate-300">{formatDate(r.purchaseDate)}</td>
      <td className="px-5 py-4 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{formatCurrency(r.amount)}</td>
      <td className="px-5 py-4">
        <Badge status={r.status}>{meta.label}</Badge>
      </td>
      <td className="px-5 py-4 text-gray-500 dark:text-slate-400">
        {r.voucher ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <ChevronRight className="h-3 w-3 rotate-180" />{r.voucher.code}
          </span>
        ) : (
          <span className="text-xs">—</span>
        )}
      </td>
      <td className="px-5 py-4 text-right">
        {img && (
          <a href={img} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            View
          </a>
        )}
      </td>
    </tr>
  );
}

function ReceiptCard({ receipt: r, meta }) {
  const img = uploadUrl(r.imageUrl);
  return (
    <div className="card rounded-2xl p-4">
      <div className="flex items-start gap-3.5">
        <Thumb src={img} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-semibold text-gray-900 dark:text-white">{r.orderId}</p>
            <p className="shrink-0 font-bold tabular-nums text-gray-900 dark:text-white">{formatCurrency(r.amount)}</p>
          </div>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
            {formatDate(r.purchaseDate)} · {formatDateTime(r.submittedAt)}
          </p>
          <div className="mt-2.5 flex items-center justify-between">
            <Badge status={r.status}>{meta.label}</Badge>
            {img && (
              <a href={img} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                View image
              </a>
            )}
          </div>
          {r.voucher && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              🎟️ Reward issued · {r.voucher.code}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Thumb({ src }) {
  if (!src) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-300 dark:bg-slate-800/60 dark:text-slate-600">
        🧾
      </div>
    );
  }
  const isImg = /\.(jpe?g|png|webp|gif)$/i.test(src);
  return isImg ? (
    <img src={src} alt="Receipt" className="h-12 w-12 shrink-0 rounded-xl border border-gray-100 object-cover dark:border-slate-700" loading="lazy" />
  ) : (
    <a href={src} target="_blank" rel="noreferrer" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-400 dark:bg-slate-800/60 dark:text-slate-500">
      📄
    </a>
  );
}
