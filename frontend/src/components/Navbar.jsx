import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { LogOut, Settings as SettingsIcon, Sun, Moon, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Avatar } from './ui';

const navLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/upload-receipt', label: 'Upload' },
  { to: '/receipt-history', label: 'Receipts' },
  { to: '/vouchers', label: 'Rewards' },
];

export default function Navbar() {
  const { user, logout } = useAuth();
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
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200/60 bg-white/70 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-white">LoyaltyPro</span>
        </Link>

        <nav className="hidden items-center gap-0.5 rounded-full border border-gray-200/70 bg-white/70 p-1 shadow-sm md:flex dark:border-slate-800 dark:bg-slate-900/60">
          {navLinks.map((link) => {
            const active = location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
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
            {dark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <Avatar name={user?.name || user?.email || 'U'} className="!h-9 !w-9 text-xs" />
              <ChevronDown className={`hidden h-4 w-4 text-gray-400 transition-transform sm:block ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="card absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl !p-1.5 shadow-xl"
              >
                <div className="border-b border-gray-100 px-3.5 py-3 dark:border-slate-700/60">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{user?.name || 'Member'}</p>
                  <p className="truncate text-xs text-gray-400 dark:text-slate-500">{user?.email}</p>
                </div>
                <MenuLink to="/settings" icon={SettingsIcon}>Profile settings</MenuLink>
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
  );
}

function MenuLink({ to, icon: Icon, children }) {
  return (
    <Link
      role="menuitem"
      to={to}
      className="flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      <Icon className="h-4 w-4 text-gray-400 dark:text-slate-500" />
      {children}
    </Link>
  );
}

// Simple, scalable brand mark: looped reward ticket with a star notch
export function Logo({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lpshd" x1="4" y1="4" x2="36" y2="36">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#lpshd)" />
      <path
        d="M27.5 13.5v3.2a3.1 3.1 0 1 0 0 6.2v3.1a1.6 1.6 0 0 1-1.6 1.6H14.1a1.6 1.6 0 0 1-1.6-1.6v-3.1a3.1 3.1 0 1 0 0-6.2v-3.1a1.6 1.6 0 0 1 1.6-1.6h11.8a1.6 1.6 0 0 1 1.6 1.6Z"
        stroke="#fff"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="m19.4 15.6.9 1.9 2 .3-1.5 1.4.36 2.05-1.75-.93-1.75.93.35-2.05-1.5-1.4 2.05-.3.9-1.9Z" fill="#fff" />
    </svg>
  );
}
