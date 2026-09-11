import Navbar from './Navbar';
import MobileNav from './MobileNav';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#f6f6fa] pb-20 dark:bg-slate-950 md:pb-0">
      <div
        className="ambient"
        aria-hidden="true"
      />

      <Navbar />

      <main className="container-x pb-24 pt-6 md:py-12">
        {children}
      </main>

      <MobileNav />
    </div>
  );
}