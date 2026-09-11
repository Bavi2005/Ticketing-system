import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-6 text-center">
      <div className="ambient" aria-hidden="true" />
      <p className="text-[9rem] font-black leading-none tracking-tighter text-white/5 sm:text-[13rem]">404</p>
      <div className="-mt-20 sm:-mt-24">
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          This page wandered off.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-slate-400">
          The page you're looking for doesn't exist or may have been moved. Let's get you back to your rewards.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-10 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition hover:from-indigo-500 hover:to-violet-500 hover:shadow-indigo-600/50 active:scale-[0.98]"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}