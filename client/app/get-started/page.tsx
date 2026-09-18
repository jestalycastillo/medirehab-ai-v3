import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, HeartPulse, Stethoscope, UserCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Let's Get Started — MediRehab AI",
  description: "Begin your rehabilitation journey with MediRehab AI.",
};

export default function GetStartedPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#FAFCFB] px-6 py-16 text-[#0F2926]">
      {/* Background Soft Glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#D3F0EC]/50 blur-3xl" />

      {/* Back to Home Button */}
      <Link
        href="/"
        className="absolute left-6 top-6 inline-flex items-center gap-2 rounded-full border border-[#D7E7E3] bg-white px-4 py-2 text-sm font-semibold text-[#4A6360] shadow-sm transition-all hover:bg-[#ECF9F7] hover:text-[#0F766E] md:left-12 md:top-8"
      >
        <ArrowLeft className="size-4" />
        Back to Home
      </Link>

      <div className="relative w-full max-w-4xl">
        {/* Brand Logo */}
        <div className="flex justify-center">
          <Link href="/" className="inline-flex items-center gap-3 no-underline group">
            <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-[#0F766E] to-[#0B4A47] text-white shadow-md shadow-[#0F766E]/20 transition-transform group-hover:scale-105">
              <HeartPulse className="size-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#0F2926]">
              MediRehab<span className="text-[#0F766E]"> AI</span>
            </span>
          </Link>
        </div>

        {/* Large Minimal Heading */}
        <div className="mx-auto mt-12 max-w-2xl text-center">
          <h1 className="text-5xl font-black tracking-[-0.04em] text-[#0F2926] sm:text-6xl">
            Let&apos;s Get Started
          </h1>
        </div>

        {/* Workspace Choices */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {/* Doctor Option */}
          <Link
            href="/login/doctor"
            className="group relative overflow-hidden rounded-[2rem] border-2 border-white bg-white p-8 shadow-xl shadow-[#0F766E]/5 transition-all duration-300 hover:-translate-y-1 hover:border-[#0F766E] hover:shadow-2xl hover:shadow-[#0F766E]/15"
          >
            <div className="flex items-start justify-between">
              <div className="grid size-14 place-items-center rounded-2xl bg-[#ECF9F7] text-[#0F766E] transition-colors group-hover:bg-[#0F766E] group-hover:text-white">
                <Stethoscope className="size-7" />
              </div>
              <span className="rounded-full bg-[#ECF9F7] px-3 py-1 text-xs font-semibold text-[#0F766E]">
                Doctor
              </span>
            </div>
            <h2 className="mt-8 text-2xl font-bold tracking-tight text-[#0F2926]">
              Clinician Portal
            </h2>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0F766E]">
              <span>Sign In</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Patient Option */}
          <Link
            href="/login/patient"
            className="group relative overflow-hidden rounded-[2rem] border-2 border-white bg-white p-8 shadow-xl shadow-[#0F766E]/5 transition-all duration-300 hover:-translate-y-1 hover:border-[#0F766E] hover:shadow-2xl hover:shadow-[#0F766E]/15"
          >
            <div className="flex items-start justify-between">
              <div className="grid size-14 place-items-center rounded-2xl bg-[#ECF9F7] text-[#0F766E] transition-colors group-hover:bg-[#0F766E] group-hover:text-white">
                <UserCheck className="size-7" />
              </div>
              <span className="rounded-full bg-[#ECF9F7] px-3 py-1 text-xs font-semibold text-[#0F766E]">
                Patient
              </span>
            </div>
            <h2 className="mt-8 text-2xl font-bold tracking-tight text-[#0F2926]">
              Patient Portal
            </h2>
            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0F766E]">
              <span>Sign In</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
