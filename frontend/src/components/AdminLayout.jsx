import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { LogOut, LayoutDashboard, ReceiptText, ShieldCheck, Sun, Moon, ChevronDown } from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { useTheme } from '../contexts/ThemeContext';
import { Avatar } from './ui';
import { Logo } from './Navbar';

const navLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/receipts', label: 'Receipts', icon: ReceiptText },
];

export default function AdminLayout({ children }) {
  const { admin, logout } = useAdmin();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClickOutside = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-[#f6f6fa] pb-20 dark:bg-slate-950 lg:pb-0">
      <div className="ambient" aria-hidden="true" />

      {/* Top navbar — same visual language as the user portal */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-200/60 bg-white/70 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">LoyaltyPro</span>
            <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600 ring-1 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20">
              <ShieldCheck className="h-3 w-3" /> Admin
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 rounded-full border border-gray-200/70 bg-white/70 p-1 shadow-sm md:flex dark:border-slate-800 dark:bg-slate-900/60">
            {navLinks.map((link) => {
              const active = location.pathname.startsWith(link.to);
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              onClick={toggle}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:text-gray-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Admin account menu"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <Avatar name={admin?.name || admin?.email || 'A'} className="!h-9 !w-9 text-xs" />
                <ChevronDown className={`hidden h-4 w-4 text-gray-400 transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div role="menu" className="card absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl !p-1.5 shadow-xl">
                  <div className="border-b border-gray-100 px-3.5 py-3 dark:border-slate-700/60">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{admin?.name || 'Admin'}</p>
                    <p className="truncate text-xs text-gray-400 dark:text-slate-500">{admin?.email}</p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container-x pt-6 pb-24 lg:py-12">{children}</main>

      {/* Mobile bottom nav — matches the user portal's MobileNav */}
      <nav
        aria-label="Admin"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-between border-t border-gray-200 bg-white px-2 pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-950/95 lg:hidden"
      >
        {navLinks.map(({ to, label, icon: Icon }) => {
          const active = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
            >
              <Icon className={`h-5 w-5 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-500'}`} />
              <span className={`text-[10px] font-semibold ${active ? 'text-indigo-600 dark:text-indigo-300' : 'text-gray-500 dark:text-slate-500'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}