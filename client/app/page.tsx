"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, HeartPulse, Activity, ShieldCheck } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAFCFB] text-[#0F2926] antialiased selection:bg-[#0F766E]/15 selection:text-[#0F766E]">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 border-b border-[#E2ECE9]/60 bg-[#FAFCFB]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-12">
          {/* Brand / Logo */}
          <Link href="/" className="inline-flex items-center gap-2.5 no-underline group">
            <HeartPulse className="size-6 text-[#0F766E] transition-transform duration-300 group-hover:scale-110" />
            <span className="text-xl font-bold tracking-tight text-[#0F2926]">
              MediRehab<span className="text-[#0F766E]"> AI</span>
            </span>
          </Link>

          {/* Minimal Visual Navigation */}
          <nav className="hidden items-center gap-10 text-sm font-medium text-[#4A6360] md:flex">
            <a href="#home" className="transition-colors hover:text-[#0F766E]">
              Home
            </a>
            <a href="#technology" className="transition-colors hover:text-[#0F766E]">
              About
            </a>
            <a href="#showcase" className="transition-colors hover:text-[#0F766E]">
              Services
            </a>
            <a href="#cta" className="transition-colors hover:text-[#0F766E]">
              Contact
            </a>
          </nav>

          {/* Prominent Action */}
          <Link
            href="/get-started"
            className="inline-flex items-center gap-2 rounded-full bg-[#0F766E] px-6 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-[#0B4A47] hover:-translate-y-0.5"
          >
            Get Started
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <main className="space-y-0">
        {/* ── HERO SECTION: FULL-WIDTH BACKGROUND IMAGE ── */}
        <section
          id="home"
          className="relative flex min-h-[85vh] w-full items-center overflow-hidden bg-[#FAFCFB] px-6 py-20 lg:min-h-[88vh] lg:px-12 lg:py-28"
        >
          {/* Full-Width Background Layer */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/landing_image/img3.png"
              alt="Rehabilitation clinical care"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[75%_center] lg:object-[82%_center]"
            />
            {/* Horizontal Blend: Solid on Left → Clear Photo on Right */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#FAFCFB] via-[#FAFCFB]/55 via-32% md:via-[#FAFCFB]/35 md:via-46% to-transparent" />
            
            {/* Smooth Edge Transitions */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#FAFCFB]/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#FAFCFB]/55 to-transparent" />
          </div>

          {/* Content */}
          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <div className="max-w-2xl lg:max-w-3xl">
              <h1 className="text-balance text-5xl font-black tracking-[-0.04em] text-[#0F2926] sm:text-6xl lg:text-7xl xl:text-8xl leading-[1.02]">
                Smarter Recovery.
                <span className="block bg-gradient-to-r from-[#0F766E] to-[#14B8A6] bg-clip-text text-transparent">
                  Better Movement.
                </span>
              </h1>

              <div className="mt-10 lg:mt-12">
                <Link
                  href="/get-started"
                  className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#0F766E] to-[#0B4A47] px-9 py-4 text-base font-bold text-white transition-all duration-300 hover:scale-105 hover:brightness-110"
                >
                  <span>Get Started</span>
                  <ArrowRight className="size-5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 1: VISUAL FEATURE (BACKGROUND IMG1) ── */}
        <section
          id="technology"
          className="relative flex min-h-[75vh] w-full items-center overflow-hidden bg-[#FAFCFB] px-6 py-20 lg:min-h-[80vh] lg:px-12 lg:py-28"
        >
          {/* Full-Width Background Layer (Subject on Left/Center) */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/landing_image/img1.jpg"
              alt="Clinical motion guidance background"
              fill
              sizes="100vw"
              className="object-cover object-[25%_center] lg:object-[20%_center]"
            />
            {/* Horizontal Blend: Clear Photo on Left → Solid Color on Right for Content */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FAFCFB]/40 via-38% md:via-[#FAFCFB]/70 md:via-52% to-[#FAFCFB]" />
            
            {/* Smooth Edge Transitions */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#FAFCFB]/55 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#FAFCFB]/55 to-transparent" />
          </div>

          {/* Content Positioned on the Solid Color Side */}
          <div className="relative z-10 mx-auto flex w-full max-w-7xl justify-end">
            <div className="max-w-xl lg:max-w-2xl">
              <h2 className="text-4xl font-extrabold tracking-[-0.04em] text-[#0F2926] sm:text-5xl lg:text-6xl leading-[1.08]">
                Technology Meets Rehabilitation
              </h2>

              <div className="mt-10 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#D7E7E3] bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#0F766E] shadow-sm backdrop-blur-sm">
                  <Activity className="size-4 text-[#0F766E]" />
                  Real-Time Tracking
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#D7E7E3] bg-white/90 px-5 py-2.5 text-sm font-semibold text-[#0F766E] shadow-sm backdrop-blur-sm">
                  <ShieldCheck className="size-4 text-[#0F766E]" />
                  AI-Assisted Recovery
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 2: REHABILITATION SHOWCASE (BACKGROUND IMG2) ── */}
        <section
          id="showcase"
          className="relative flex min-h-[75vh] w-full items-center overflow-hidden bg-[#FAFCFB] px-6 py-20 lg:min-h-[80vh] lg:px-12 lg:py-28"
        >
          {/* Full-Width Background Layer (Subject on Right) */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/landing_image/img2.jpg"
              alt="Physical rehabilitation tracking background"
              fill
              sizes="100vw"
              className="object-cover object-[75%_center] lg:object-[80%_center]"
            />
            {/* Horizontal Blend: Solid on Left for Content → Clear Photo on Right */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#FAFCFB] via-[#FAFCFB]/55 via-32% md:via-[#FAFCFB]/35 md:via-46% to-transparent" />
            
            {/* Smooth Edge Transitions */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#FAFCFB]/55 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#FAFCFB]/55 to-transparent" />
          </div>

          {/* Content Positioned on the Solid Color Side */}
          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <div className="max-w-xl lg:max-w-2xl">
              <h2 className="text-4xl font-extrabold tracking-[-0.04em] text-[#0F2926] sm:text-5xl lg:text-6xl leading-[1.08]">
                Move Better.
                <span className="block text-[#0F766E]">Recover Smarter.</span>
              </h2>

              <div className="mt-10 flex flex-wrap gap-3">
                <span className="rounded-full border border-[#D7E7E3] bg-white/90 px-5 py-2.5 text-sm font-bold text-[#0F2926] shadow-sm backdrop-blur-sm">
                  Personalized Care
                </span>
                <span className="rounded-full border border-[#D7E7E3] bg-white/90 px-5 py-2.5 text-sm font-bold text-[#0F2926] shadow-sm backdrop-blur-sm">
                  Smart Rehabilitation
                </span>
                <span className="rounded-full border border-[#D7E7E3] bg-white/90 px-5 py-2.5 text-sm font-bold text-[#0F2926] shadow-sm backdrop-blur-sm">
                  Better Movement
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA SECTION ── */}
        <section id="cta" className="relative flex min-h-[60vh] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#0B4A47] via-[#0F766E] to-[#115E59] px-6 py-24 text-center text-white lg:py-28">
          {/* Subtle Background Photography */}
          <div className="absolute inset-0 z-0 opacity-15 mix-blend-overlay">
            <Image
              src="/landing_image/img3.png"
              alt="Rehabilitation background"
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>

          {/* Soft top gradient blend */}
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#FAFCFB]/30 to-transparent" />

          {/* Content */}
          <div className="relative z-10 mx-auto max-w-4xl px-6">
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Ready to Begin?
            </h2>

            <div className="mt-10">
              <Link
                href="/get-started"
                className="inline-flex items-center gap-3 rounded-full bg-white px-9 py-4 text-base font-bold text-[#0B4A47] transition-all duration-300 hover:scale-105 hover:bg-[#D3F0EC]"
              >
                <span>Get Started</span>
                <ArrowRight className="size-5 text-[#0F766E]" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0B4A47] px-6 py-12 text-white/80 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <Link href="/" className="inline-flex items-center gap-2.5 no-underline">
            <HeartPulse className="size-5 text-[#34D399]" />
            <span className="text-base font-bold text-white">
              MediRehab<span className="text-[#34D399]"> AI</span>
            </span>
          </Link>

          <div className="text-xs text-white/60">
            © {new Date().getFullYear()} MediRehab AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
