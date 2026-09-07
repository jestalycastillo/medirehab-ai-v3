import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Get Started — MediRehab AI",
  description: "Choose your MediRehab AI workspace.",
};

function ArrowIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function ArrowLeftIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>;
}

function HeartPulseIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 8.8a5 5 0 0 0-8.8-2.9a5 5 0 1 0-8.8 2.9L12 19l8.8-10.2Z" /><path d="M4 12h4l1.5-3 2.5 6 1.5-3H20" /></svg>;
}

function StethoscopeIcon() {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3v5a6 6 0 0 0 12 0V3" /><path d="M3 3h6M15 3h6" /><path d="M12 14v2a4 4 0 0 0 8 0v-1" /><circle cx="20" cy="13" r="2" /></svg>;
}

function PatientIcon() {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>;
}

function RoleChoice({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return <Link href={href} className="get-started-card group relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-white p-7 no-underline shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-elevated)] md:p-8" style={{ animation: "get-started-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards", animationDelay: title === "Doctor" ? "240ms" : "360ms" }}><div className="absolute right-0 top-0 size-32 rounded-full bg-[var(--color-primary-soft)] opacity-70 blur-2xl transition-transform duration-500 group-hover:scale-150" /><div className="relative"><div className="flex items-start justify-between"><span className="grid size-12 place-items-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]">{icon}</span><span className="text-[var(--color-primary)] transition-transform duration-200 group-hover:translate-x-1"></span></div><h2 className="mt-8 text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{title}</h2><p className="mt-2 text-sm text-[var(--color-text-muted)]">{detail}</p><div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary-dark)]">Continue <ArrowIcon /></div></div></Link>;
}

export default function GetStartedPage() {
  return <main className="get-started-page relative grid min-h-screen place-items-center overflow-hidden bg-[var(--color-page-bg)] px-6 py-12 text-[var(--color-text-primary)]"><style>{`@keyframes get-started-reveal { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }`}</style><div className="pointer-events-none absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-primary-light)] opacity-50 blur-3xl" /><Link href="/" className="absolute left-6 top-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-muted)] no-underline transition-colors hover:text-[var(--color-primary-dark)] md:left-10 md:top-8"><ArrowLeftIcon />Back</Link><div className="relative w-full max-w-4xl"><div className="get-started-logo flex justify-center" style={{ opacity: 0, animation: "get-started-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards" }}><Link href="/" className="inline-flex items-center gap-2.5 no-underline"><span className="grid size-9 place-items-center rounded-xl bg-[var(--color-primary)] text-white shadow-sm"><HeartPulseIcon /></span><span className="text-[17px] font-bold tracking-tight">MediRehab<span className="text-[var(--color-primary)]"> AI</span></span></Link></div><div className="get-started-heading mx-auto mt-16 max-w-2xl text-center md:mt-20" style={{ opacity: 0, animation: "get-started-reveal 700ms cubic-bezier(0.22, 1, 0.36, 1) 120ms forwards" }}><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">Get started</div><h1 className="mt-5 text-4xl font-bold leading-tight tracking-[-0.05em] md:text-6xl">Choose your workspace.</h1><p className="mt-5 text-base text-[var(--color-text-secondary)] md:text-lg">Select the view that fits your care journey.</p></div><div className="get-started-choices mt-12 grid gap-5 md:grid-cols-2"><RoleChoice href="/login/doctor" icon={<StethoscopeIcon />} title="Doctor" detail="Manage care plans and patient progress." /><RoleChoice href="/login/patient" icon={<PatientIcon />} title="Patient" detail="View exercises and track your sessions." /></div></div></main>;
}
