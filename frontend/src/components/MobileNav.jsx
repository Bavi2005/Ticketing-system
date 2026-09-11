import {
  Link,
  useLocation,
} from 'react-router-dom';

import {
  Home,
  ReceiptText,
  ScanLine,
  Gift,
  User,
} from 'lucide-react';

const items = [
  {
    to: '/dashboard',
    label: 'Home',
    icon: Home,
  },
  {
    to: '/receipt-history',
    label: 'Receipts',
    icon: ReceiptText,
  },
  {
    to: '/upload-receipt',
    label: 'Upload',
    icon: ScanLine,
    primary: true,
  },
  {
    to: '/vouchers',
    label: 'Vouchers',
    icon: Gift,
  },
  {
    to: '/settings',
    label: 'Account',
    icon: User,
  },
];

export default function MobileNav() {
  const location = useLocation();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-between border-t border-gray-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-950/95 md:hidden"
    >
      {items.map(
        ({
          to,
          label,
          icon: Icon,
          primary,
        }) => {
          const active =
            location.pathname.startsWith(to);

          if (primary) {
            return (
              <Link
                key={to}
                to={to}
                className="relative flex w-16 flex-col items-center justify-center py-1"
                aria-label="Upload receipt"
              >
                <span className="absolute -top-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-500/30 ring-4 ring-white dark:ring-slate-950">
                  <Icon className="h-6 w-6" />
                </span>

                <span className="mt-7 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={to}
              to={to}
              aria-current={
                active ? 'page' : undefined
              }
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
            >
              <Icon
                className={`h-5 w-5 ${
                  active
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-400 dark:text-slate-500'
                }`}
              />

              <span
                className={`text-[10px] font-semibold ${
                  active
                    ? 'text-indigo-600 dark:text-indigo-300'
                    : 'text-gray-500 dark:text-slate-500'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        }
      )}
    </nav>
  );
}