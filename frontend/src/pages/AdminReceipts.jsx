import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Check, X, ExternalLink, ReceiptText } from 'lucide-react';
import { api as axios, uploadUrl } from '../api';
import { useAdmin } from '../contexts/AdminContext';
import { useToast, PageHeader, Badge, SkeletonLoader, EmptyState } from '../components/ui';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import confetti from 'canvas-confetti';

const FILTERS = ['PENDING', 'APPROVED', 'REJECTED'];

export default function AdminReceipts() {
  const { admin } = useAdmin();
  const { success, error: toastError } = useToast();

  const [receipts, setReceipts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (status) params.append('status', status);
      if (search.trim()) params.append('search', search.trim());
      const { data } = await axios.get(`/api/admin/receipts?${params.toString()}`);
      setReceipts(data.receipts);
      setPagination(data.pagination);
    } catch (err) {
      toastError('Failed to load receipts', err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [page, status, search, toastError]);

  useEffect(() => {
    if (admin) load();
  }, [admin, load]);

  const act = async (id, action) => {
    setBusyId(id);
    try {
      await axios.post(`/api/admin/receipts/${id}/${action}`);
      success(
        action === 'approve' ? 'Receipt approved' : 'Receipt rejected',
        action === 'approve' ? 'A voucher has been issued.' : undefined
      );
      if (action === 'approve') {
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
      }
      await load();
    } catch (err) {
      toastError(`Failed to ${action}`, err.response?.data?.message || 'Something went wrong');
    } finally {
      setBusyId(null);
    }
  };

  const img = (r) => uploadUrl(r.imageUrl);

  return (
    <div>
      <PageHeader
        title="Receipt validation"
        subtitle="Review submissions and approve to issue vouchers."
        action={
          <Link to="/admin/dashboard" className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
            Dashboard
          </Link>
        }
      />

      {/* Filter bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search order ID, name or email…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:placeholder-slate-500"
          />
        </div>
        <div className="inline-flex rounded-xl bg-gray-100 p-1 ring-1 ring-gray-200/60 dark:bg-slate-800/60 dark:ring-slate-700/50">
          <button
            onClick={() => { setStatus(''); setPage(1); }}
            aria-pressed={!status}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
              !status ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            All
          </button>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => { setStatus(f); setPage(1); }}
              aria-pressed={status === f}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                status === f ? 'bg-white text-gray-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <SkeletonLoader key={i} height="96px" className="rounded-2xl" />)}
        </div>
      ) : receipts.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No receipts found"
          description="Try adjusting the filters or search."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden rounded-2xl md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-400">
                  <th className="px-5 py-3.5">Receipt</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Amount</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                {receipts.map((r) => (
                  <tr key={r.id} className="transition hover:bg-gray-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {img(r) && /\.(jpe?g|png|webp|gif)$/i.test(img(r)) ? (
                          <img src={img(r)} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-gray-100 object-cover dark:border-slate-700" loading="lazy" />
                        ) : (
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-slate-800/60 dark:text-slate-500">
                            <ReceiptText className="h-5 w-5" />
                          </span>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{r.orderId}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(r.submittedAt)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-slate-300">{r.user?.name || r.user?.email}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-slate-300">{formatDate(r.purchaseDate)}</td>
                    <td className="px-5 py-4 text-right font-semibold tabular-nums text-gray-900 dark:text-white">{formatCurrency(r.amount)}</td>
                    <td className="px-5 py-4"><Badge status={r.status}>{r.status}</Badge></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {r.imageUrl && (
                          <a href={img(r)} target="_blank" rel="noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition hover:text-indigo-600 dark:border-slate-700" aria-label="View file">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                        {r.status === 'PENDING' ? (
                          <>
                            <button
                              onClick={() => act(r.id, 'approve')}
                              disabled={busyId === r.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2 text-[13px] font-semibold text-white shadow-md transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-60"
                            >
                              <Check className="h-4 w-4" />
                              {busyId === r.id ? '…' : 'Approve'}
                            </button>
                            <button
                              onClick={() => act(r.id, 'reject')}
                              disabled={busyId === r.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/30 dark:hover:bg-rose-500/10"
                            >
                              <X className="h-4 w-4" />
                              Reject
                            </button>
                          </>
                        ) : r.voucher ? (
                          <span className="text-xs font-medium text-gray-400 dark:text-slate-500">Voucher <span className="font-mono">({r.voucher.code})</span></span>
                        ) : (
                          <span className="text-xs font-medium text-gray-400 dark:text-slate-500">{r.status.toLowerCase()}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {receipts.map((r) => (
              <div key={r.id} className="card rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{r.orderId}</p>
                    <p className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">{r.user?.name || r.user?.email}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{formatDate(r.purchaseDate)} · {formatCurrency(r.amount)}</p>
                  </div>
                  <Badge status={r.status}>{r.status}</Badge>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {r.imageUrl && (
                    <a href={img(r)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-[13px] font-semibold text-indigo-600 dark:border-slate-700">
                      View file
                    </a>
                  )}
                  {r.status === 'PENDING' ? (
                    <>
                      <button
                        onClick={() => act(r.id, 'approve')}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3.5 py-2 text-[13px] font-semibold text-white shadow-md disabled:opacity-60"
                      >
                        <Check className="h-4 w-4" /> Approve
                      </button>
                      <button
                        onClick={() => act(r.id, 'reject')}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3.5 py-2 text-[13px] font-semibold text-rose-600 dark:border-rose-500/30"
                      >
                        <X className="h-4 w-4" /> Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-medium text-gray-400 dark:text-slate-500">
                      {r.voucher ? `Voucher (${r.voucher.code})` : r.status.toLowerCase()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
            <span>Showing {receipts.length} of {pagination.total}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Previous
              </button>
              <span className="px-2 py-1.5">{pagination.page} / {pagination.totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}