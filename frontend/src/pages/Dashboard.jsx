import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

import {
  Gift,
  ReceiptText,
  Clock,
  Wallet,
  ArrowRight,
  ChevronRight,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useUser } from '../contexts/UserContext';

import {
  SkeletonLoader,
  Badge,
} from '../components/ui';

import { Logo } from '../components/Navbar';

import {
  formatCurrency,
  formatDateTime,
  timeAgoExpiry,
} from '../utils/formatters';

function greeting() {
  const hour = new Date().getHours();

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';

  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();

  const {
    stats,
    receipts,
    vouchers,
    loading,
    error,
    refreshStats,
  } = useUser();

  // refreshStats already loads dashboard,
  // receipts and vouchers together.
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  if (loading && !stats) {
    return (
      <div className="space-y-7 lg:space-y-10">
        <SkeletonLoader
          width="50%"
          height="36px"
        />

        <SkeletonLoader
          height="200px"
          className="rounded-2xl"
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonLoader
              key={i}
              height="110px"
              className="rounded-2xl"
            />
          ))}
        </div>

        <SkeletonLoader
          height="220px"
          className="rounded-2xl"
        />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="card mx-auto max-w-md rounded-2xl p-8 text-center">
        <p className="text-sm font-medium text-rose-600">
          {error}
        </p>

        <button
          type="button"
          onClick={refreshStats}
          className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  const approved = Number(
    stats?.approvedReceipts || 0
  );

  const pending = Number(
    stats?.pendingReceipts || 0
  );

  const spent = Number(
    stats?.totalSpent || 0
  );

  const available = (vouchers || []).filter(
    (voucher) =>
      !voucher.redeemedAt &&
      (
        !voucher.expiresAt ||
        new Date(voucher.expiresAt) > new Date()
      )
  ).length;

  const recent = (receipts || []).slice(0, 5);

  const quickStats = [
    {
      label: 'Available vouchers',
      value: available,
      icon: Gift,
    },
    {
      label: 'Being reviewed',
      value: pending,
      icon: Clock,
    },
    {
      label: 'Approved receipts',
      value: approved,
      icon: ReceiptText,
    },
    {
      label: 'Approved spend',
      value: formatCurrency(spent),
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-7 lg:space-y-10">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          {greeting()},{' '}
          {user?.name?.split(' ')[0] || 'there'}
        </h1>

        <p className="mt-2 text-[15px] text-gray-500 dark:text-slate-400">
          Upload a purchase receipt, track its review,
          and receive a voucher after approval.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
        {/* Main loyalty card */}
        <motion.section
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.4,
          }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-[#0F172A] p-6 text-white shadow-xl shadow-indigo-900/20 ring-1 ring-indigo-400/20 sm:p-8 lg:col-span-3 lg:p-10"
        >
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:24px_24px]" />

          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />

              <span className="text-sm font-semibold tracking-wide text-white/90">
                LoyaltyPro
              </span>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-100 ring-1 ring-white/20">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Receipt rewards
            </span>
          </div>

          <div className="relative mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-200/80">
              Approved receipts
            </p>

            <p className="mt-2 text-5xl font-extrabold tracking-tight">
              {approved}
            </p>

            <p className="mt-2 max-w-lg text-sm leading-relaxed text-indigo-100/90">
              Each approved receipt automatically
              creates one voucher for your account.
            </p>
          </div>

          <div className="relative mt-6">
            <Link
              to="/upload-receipt"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              <UploadCloud className="h-4 w-4" />
              Upload receipt
            </Link>
          </div>
        </motion.section>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          {quickStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{
                opacity: 0,
                y: 12,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.35,
                delay: 0.08 + index * 0.05,
              }}
              className="card rounded-2xl p-5 sm:p-6"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                <stat.icon className="h-5 w-5" />
              </div>

              <p className="mt-3 text-2xl font-extrabold tabular-nums tracking-tight text-gray-900 dark:text-white">
                {stat.value}
              </p>

              <p className="text-[12px] font-medium text-gray-500 dark:text-slate-400">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent receipts */}
      <motion.section
        initial={{
          opacity: 0,
          y: 14,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.4,
          delay: 0.2,
        }}
        className="card rounded-2xl p-6 sm:p-7"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Recent activity
          </h2>

          <Link
            to="/receipt-history"
            className="group inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            View all

            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-xl bg-gray-50 px-6 py-10 text-center dark:bg-slate-800/60">
            <p className="text-sm font-medium text-gray-600 dark:text-slate-300">
              No receipts yet
            </p>

            <p className="mt-1 text-sm text-gray-400 dark:text-slate-500">
              <Link
                to="/upload-receipt"
                className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Upload your first receipt
              </Link>{' '}
              to begin.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-slate-700/60">
            {recent.map((receipt) => (
              <li
                key={receipt.id}
                className="flex items-center gap-4 py-3.5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <ReceiptText className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900 dark:text-white">
                    {receipt.orderId}
                  </p>

                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {formatDateTime(
                      receipt.submittedAt
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold tabular-nums text-gray-900 dark:text-white">
                    {formatCurrency(
                      receipt.amount
                    )}
                  </p>

                  <Badge status={receipt.status}>
                    {receipt.status === 'PENDING'
                      ? 'Under review'
                      : receipt.status === 'APPROVED'
                        ? 'Approved'
                        : 'Rejected'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* Voucher notification */}
      {available > 0 && (
        <motion.section
          initial={{
            opacity: 0,
            y: 14,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.4,
            delay: 0.3,
          }}
          className="card flex flex-wrap items-center justify-between gap-4 rounded-2xl border-l-4 border-l-amber-400 p-6"
        >
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-500/10">
              <Gift className="h-6 w-6" />
            </span>

            <div>
              <p className="font-bold text-gray-900 dark:text-white">
                {available} voucher
                {available === 1 ? '' : 's'} ready
                to use
              </p>

              <p className="text-sm text-gray-500 dark:text-slate-400">
                {(vouchers || [])
                  .filter(
                    (voucher) =>
                      !voucher.redeemedAt &&
                      voucher.expiresAt
                  )
                  .slice(0, 1)
                  .map((voucher) => {
                    const expiry =
                      timeAgoExpiry(
                        voucher.expiresAt
                      );

                    return expiry
                      ? `Next expiry: ${expiry}`
                      : '';
                  })}
              </p>
            </div>
          </div>

          <Link
            to="/vouchers"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-600/25 transition hover:bg-indigo-500"
          >
            View vouchers

            <ChevronRight className="h-4 w-4" />
          </Link>
        </motion.section>
      )}
    </div>
  );
}