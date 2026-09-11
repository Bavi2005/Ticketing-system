import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const STAGGER = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.09, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  headline,
  brandPoints = [],
  admin = false,
}) {
  return (
    <div className="flex min-h-screen items-stretch bg-[#f4f4f8] p-4 sm:p-6 dark:bg-slate-900">
      {/* Floating island brand panel */}
      <div
        className={`relative hidden flex-none basis-[44%] overflow-hidden rounded-3xl lg:flex lg:min-h-[calc(100vh-3rem)] ${
          admin
            ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950'
            : 'bg-gradient-to-br from-indigo-600 via-violet-600 to-violet-700'
        }`}
      >
        {/* glows + dot texture */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.07)_1px,transparent_0)] bg-[size:24px_24px]" />

        <div className="relative flex h-full w-full flex-col justify-between px-12 py-12 xl:px-14">
          <motion.div variants={STAGGER} initial="hidden" animate="show" custom={0}>
            <Link to="/login" className="flex w-fit items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur">
                LP
              </div>
              <span className="text-lg font-extrabold tracking-tight text-white">LoyaltyPro</span>
            </Link>
          </motion.div>

          <div>
            <motion.h1
              variants={STAGGER}
              initial="hidden"
              animate="show"
              custom={1}
              className="max-w-lg text-4xl font-extrabold leading-[1.12] tracking-tight text-white xl:text-5xl"
            >
              {headline}
            </motion.h1>
            <motion.p
              variants={STAGGER}
              initial="hidden"
              animate="show"
              custom={2}
              className="mt-4 max-w-md text-[15px] leading-relaxed text-indigo-100"
            >
              {subtitle}
            </motion.p>

            <div className="mt-10 space-y-4">
              {brandPoints.map((point, i) => (
                <motion.div
                  key={point}
                  variants={STAGGER}
                  initial="hidden"
                  animate="show"
                  custom={3 + i}
                  className="flex items-center gap-3.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                    <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <p className="text-sm font-medium text-white/95">{point}</p>
                </motion.div>
              ))}
            </div>

            {/* glass loyalty card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.6, ease: 'easeOut' }}
              className="mt-14 max-w-sm rounded-2xl bg-white/10 px-6 py-5 ring-1 ring-white/20 backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-100">Gold Member</p>
                <span className="text-xl">🏅</span>
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-white">2,450</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-200">Points balance</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '72%' }}
                  transition={{ delay: 1, duration: 1, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-300 to-pink-400"
                />
              </div>
              <p className="mt-2.5 text-xs text-indigo-100/85">$170 more to your next reward</p>
            </motion.div>
          </div>

          <motion.p
            variants={STAGGER}
            initial="hidden"
            animate="show"
            custom={6}
            className="text-xs text-indigo-200/80"
          >
            © {new Date().getFullYear()} LoyaltyPro — rewards that keep customers coming back.
          </motion.p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
        >
          <div className="mb-10 lg:hidden">
            <Link to="/login" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-600/30">
                LP
              </div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">LoyaltyPro</span>
            </Link>
          </div>

          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>

          <div className="mt-10">{children}</div>

          {footer}
        </motion.div>
      </div>
    </div>
  );
}
