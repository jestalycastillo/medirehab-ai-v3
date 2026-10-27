"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Activity, ShieldCheck, Sparkles, Menu, X, CheckCircle2 } from "lucide-react";
import { MediRehabLogo } from "@/components/medirehab-logo";
import "./public-responsive.css";

export default function HomePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on resize to desktop width
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="landing-page min-h-screen bg-[#FAFCFB] text-[#0F2926] antialiased selection:bg-[#0F766E]/15 selection:text-[#0F766E] overflow-x-hidden">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-[#E2ECE9]/70 bg-[#FAFCFB]/90 backdrop-blur-xl">
        <div className="landing-header-bar mx-auto flex h-16 sm:h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-12">
          {/* Brand / Logo */}
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 no-underline group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] rounded-lg"
          >
            <MediRehabLogo className="size-8 sm:size-9" />
            <span className="text-lg sm:text-xl font-bold tracking-tight text-[#0F2926]">
              MediRehab<span className="text-[#0F766E]"> AI</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 lg:gap-10 text-sm font-medium text-[#4A6360] md:flex" aria-label="Main Navigation">
            <a href="#home" className="transition-colors hover:text-[#0F766E] py-2">
              Home
            </a>
            <a href="#technology" className="transition-colors hover:text-[#0F766E] py-2">
              About
            </a>
            <a href="#showcase" className="transition-colors hover:text-[#0F766E] py-2">
              Services
            </a>
            <a href="#cta" className="transition-colors hover:text-[#0F766E] py-2">
              Contact
            </a>
          </nav>

          {/* Header Action & Mobile Menu Toggle */}
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/get-started"
              className="landing-header-cta inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#0F766E] px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-[#0B4A47] hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Get Started</span>
              <ArrowRight className="size-3.5 sm:size-4" />
            </Link>

            {/* Mobile Hamburger Toggle Button */}
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-xl border border-[#D7E7E3] bg-white text-[#0F2926] shadow-sm transition-colors hover:bg-[#F0FAF8] hover:text-[#0F766E] md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E]"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Dropdown Overlay */}
      {isMobileMenuOpen && (
        <div className="landing-mobile-nav fixed inset-x-0 top-16 bottom-0 z-50 flex flex-col justify-between bg-[#FAFCFB] px-5 py-6 sm:px-6 sm:py-8 md:hidden overflow-y-auto border-b border-[#D7E7E3] shadow-2xl">
          <nav className="flex flex-col gap-1.5" aria-label="Mobile Navigation">
            <a
              href="#home"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-[#0F2926] transition-colors hover:bg-[#ECF9F7] hover:text-[#0F766E]"
            >
              <span>Home</span>
              <ArrowRight className="size-4 text-[#0F766E]/60" />
            </a>
            <a
              href="#technology"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-[#0F2926] transition-colors hover:bg-[#ECF9F7] hover:text-[#0F766E]"
            >
              <span>About Technology</span>
              <ArrowRight className="size-4 text-[#0F766E]/60" />
            </a>
            <a
              href="#showcase"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-[#0F2926] transition-colors hover:bg-[#ECF9F7] hover:text-[#0F766E]"
            >
              <span>Services &amp; Showcase</span>
              <ArrowRight className="size-4 text-[#0F766E]/60" />
            </a>
            <a
              href="#cta"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold text-[#0F2926] transition-colors hover:bg-[#ECF9F7] hover:text-[#0F766E]"
            >
              <span>Contact</span>
              <ArrowRight className="size-4 text-[#0F766E]/60" />
            </a>
          </nav>

          <div className="mt-6 flex flex-col gap-3 pt-6 border-t border-[#E2ECE9]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#4A6360]">Portals</span>
            <div className="grid grid-cols-2 gap-2.5">
              <Link
                href="/login/doctor"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center rounded-xl border border-[#D7E7E3] bg-white py-3 text-sm font-semibold text-[#0F2926] shadow-sm hover:border-[#0F766E] hover:text-[#0F766E]"
              >
                Doctor Portal
              </Link>
              <Link
                href="/login/patient"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center justify-center rounded-xl border border-[#D7E7E3] bg-white py-3 text-sm font-semibold text-[#0F2926] shadow-sm hover:border-[#0F766E] hover:text-[#0F766E]"
              >
                Patient Portal
              </Link>
            </div>

            <Link
              href="/get-started"
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] py-3.5 text-sm font-bold text-white shadow-md shadow-[#0F766E]/20 hover:bg-[#0B4A47]"
            >
              <span>Get Started Now</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      )}

      <main className="space-y-0">
        {/* ── HERO SECTION ── */}
        <section
          id="home"
          className="landing-hero relative flex min-h-[82vh] sm:min-h-[85vh] w-full items-center overflow-hidden bg-[#FAFCFB] px-4 py-16 sm:px-6 sm:py-20 lg:min-h-[88vh] lg:px-12 lg:py-28"
        >
          {/* Full-Width Background Layer */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/landing_image/img3.png"
              alt="Rehabilitation clinical care"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[75%_center] sm:object-[75%_center] lg:object-[82%_center]"
            />
            {/* Multi-tier gradient blend:
                On mobile: smooth bottom & vertical fade preserving clarity while ensuring typography has 100% contrast.
                On desktop: horizontal fade from solid left to clear right. */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#FAFCFB] via-[#FAFCFB]/85 via-50% to-[#FAFCFB]/40 sm:bg-gradient-to-r sm:from-[#FAFCFB] sm:via-[#FAFCFB]/60 sm:via-40% md:via-[#FAFCFB]/40 md:via-48% sm:to-transparent" />
            
            {/* Smooth Edge Transitions */}
            <div className="absolute inset-x-0 top-0 h-16 sm:h-20 bg-gradient-to-b from-[#FAFCFB]/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-16 sm:h-20 bg-gradient-to-t from-[#FAFCFB]/60 to-transparent" />
          </div>

          {/* Content Card with Mobile Glassmorphic Backing */}
          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <div className="landing-hero-copy max-w-2xl lg:max-w-3xl rounded-3xl sm:rounded-none bg-[#FAFCFB]/80 sm:bg-transparent p-5 sm:p-0 backdrop-blur-md sm:backdrop-blur-none border border-white/80 sm:border-0 shadow-xl shadow-[#0F766E]/5 sm:shadow-none">
              <span className="landing-hero-badge inline-flex items-center gap-1.5 rounded-full border border-[#D7E7E3] bg-white/90 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0F766E] shadow-sm mb-4 sm:mb-6">
                <Sparkles className="size-3.5 text-[#0F766E]" />
                Next-Gen Physical Therapy
              </span>

              <h1 className="landing-hero-title text-balance text-4xl font-black tracking-[-0.04em] text-[#0F2926] sm:text-6xl lg:text-7xl xl:text-8xl leading-[1.05]">
                Smarter Recovery.
                <span className="block bg-gradient-to-r from-[#0F766E] to-[#14B8A6] bg-clip-text text-transparent">
                  Better Movement.
                </span>
              </h1>

              <p className="landing-hero-description mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl text-[#3A5350] max-w-xl font-normal leading-relaxed">
                AI-assisted clinical motion guidance, real-time posture feedback, and personalized exercise tracking from the comfort of home.
              </p>

              <div className="landing-hero-actions mt-8 sm:mt-10 lg:mt-12 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4">
                <Link
                  href="/get-started"
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#0F766E] to-[#0B4A47] px-8 py-3.5 sm:px-9 sm:py-4 text-base font-bold text-white shadow-lg shadow-[#0F766E]/20 transition-all duration-300 hover:scale-105 hover:brightness-110 active:scale-100"
                >
                  <span>Get Started</span>
                  <ArrowRight className="size-5" />
                </Link>

                <a
                  href="#technology"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#D7E7E3] bg-white/90 px-6 py-3.5 text-sm font-bold text-[#0F2926] shadow-sm transition-all hover:bg-white hover:text-[#0F766E]"
                >
                  <span>How It Works</span>
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="landing-hero-trust mt-8 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-semibold text-[#4A6360]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-[#0F766E]" />
                  Real-time pose guidance
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="size-4 text-[#0F766E]" />
                  Clinician verified programs
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 1: VISUAL FEATURE ── */}
        <section
          id="technology"
          className="relative flex min-h-[75vh] w-full items-center overflow-hidden bg-[#FAFCFB] px-4 py-16 sm:px-6 sm:py-20 lg:min-h-[80vh] lg:px-12 lg:py-28"
        >
          {/* Full-Width Background Layer */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/landing_image/img1.jpg"
              alt="Clinical motion guidance background"
              fill
              sizes="100vw"
              className="object-cover object-[30%_center] sm:object-[25%_center] lg:object-[20%_center]"
            />
            {/* Horizontal & Vertical Blend */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#FAFCFB] via-[#FAFCFB]/85 via-50% to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-[#FAFCFB]/60 sm:via-40% md:via-[#FAFCFB]/70 md:via-52% sm:to-[#FAFCFB]" />
            
            {/* Smooth Edge Transitions */}
            <div className="absolute inset-x-0 top-0 h-16 sm:h-20 bg-gradient-to-b from-[#FAFCFB]/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-16 sm:h-20 bg-gradient-to-t from-[#FAFCFB]/60 to-transparent" />
          </div>

          {/* Content Positioned */}
          <div className="relative z-10 mx-auto flex w-full max-w-7xl justify-start sm:justify-end">
            <div className="max-w-xl lg:max-w-2xl rounded-3xl sm:rounded-none bg-[#FAFCFB]/85 sm:bg-transparent p-5 sm:p-0 backdrop-blur-md sm:backdrop-blur-none border border-white/80 sm:border-0 shadow-lg shadow-[#0F766E]/5 sm:shadow-none">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D7E7E3] bg-white/90 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0F766E] shadow-sm mb-4">
                <Activity className="size-3.5 text-[#0F766E]" />
                Intelligent Motion Analysis
              </span>

              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.04em] text-[#0F2926] leading-[1.08]">
                Technology Meets Rehabilitation
              </h2>

              <p className="mt-4 text-base sm:text-lg text-[#3A5350] leading-relaxed">
                State-of-the-art computer vision models analyze joint angles, range of motion, and repetition quality in real time through your standard webcam or phone.
              </p>

              <div className="mt-6 sm:mt-8 flex flex-wrap gap-2.5 sm:gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#D7E7E3] bg-white/95 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-[#0F766E] shadow-sm backdrop-blur-sm">
                  <Activity className="size-4 text-[#0F766E]" />
                  Real-Time Tracking
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#D7E7E3] bg-white/95 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-[#0F766E] shadow-sm backdrop-blur-sm">
                  <ShieldCheck className="size-4 text-[#0F766E]" />
                  AI-Assisted Recovery
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#D7E7E3] bg-white/95 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-[#0F766E] shadow-sm backdrop-blur-sm">
                  <Sparkles className="size-4 text-[#0F766E]" />
                  Voice Guidance
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 2: REHABILITATION SHOWCASE ── */}
        <section
          id="showcase"
          className="relative flex min-h-[75vh] w-full items-center overflow-hidden bg-[#FAFCFB] px-4 py-16 sm:px-6 sm:py-20 lg:min-h-[80vh] lg:px-12 lg:py-28"
        >
          {/* Full-Width Background Layer */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/landing_image/img2.jpg"
              alt="Physical rehabilitation tracking background"
              fill
              sizes="100vw"
              className="object-cover object-[75%_center] sm:object-[75%_center] lg:object-[80%_center]"
            />
            {/* Blend */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#FAFCFB] via-[#FAFCFB]/85 via-50% to-transparent sm:bg-gradient-to-r sm:from-[#FAFCFB] sm:via-[#FAFCFB]/60 sm:via-40% md:via-[#FAFCFB]/40 md:via-48% sm:to-transparent" />
            
            {/* Smooth Edge Transitions */}
            <div className="absolute inset-x-0 top-0 h-16 sm:h-20 bg-gradient-to-b from-[#FAFCFB]/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-16 sm:h-20 bg-gradient-to-t from-[#FAFCFB]/60 to-transparent" />
          </div>

          {/* Content Positioned on the Solid Color Side */}
          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <div className="max-w-xl lg:max-w-2xl rounded-3xl sm:rounded-none bg-[#FAFCFB]/85 sm:bg-transparent p-5 sm:p-0 backdrop-blur-md sm:backdrop-blur-none border border-white/80 sm:border-0 shadow-lg shadow-[#0F766E]/5 sm:shadow-none">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D7E7E3] bg-white/90 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0F766E] shadow-sm mb-4">
                <ShieldCheck className="size-3.5 text-[#0F766E]" />
                Personalized Care Plans
              </span>

              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.04em] text-[#0F2926] leading-[1.08]">
                Move Better.
                <span className="block text-[#0F766E]">Recover Smarter.</span>
              </h2>

              <p className="mt-4 text-base sm:text-lg text-[#3A5350] leading-relaxed">
                Empower your recovery with personalized home therapy, interactive repetition counting, and detailed adherence metrics sent directly to your therapist.
              </p>

              <div className="mt-6 sm:mt-8 flex flex-wrap gap-2.5 sm:gap-3">
                <span className="rounded-full border border-[#D7E7E3] bg-white/95 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-[#0F2926] shadow-sm backdrop-blur-sm">
                  Personalized Care
                </span>
                <span className="rounded-full border border-[#D7E7E3] bg-white/95 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-[#0F2926] shadow-sm backdrop-blur-sm">
                  Smart Rehabilitation
                </span>
                <span className="rounded-full border border-[#D7E7E3] bg-white/95 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-bold text-[#0F2926] shadow-sm backdrop-blur-sm">
                  Progress Tracking
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA SECTION ── */}
        <section
          id="cta"
          className="relative flex min-h-[55vh] sm:min-h-[60vh] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#0B4A47] via-[#0F766E] to-[#115E59] px-4 py-20 sm:px-6 sm:py-24 text-center text-white lg:py-28"
        >
          {/* Subtle Background Photography */}
          <div className="absolute inset-0 z-0 opacity-15 mix-blend-overlay pointer-events-none">
            <Image
              src="/landing_image/img3.png"
              alt="Rehabilitation background"
              fill
              sizes="100vw"
              className="object-cover"
            />
          </div>

          {/* Soft top gradient blend */}
          <div className="absolute inset-x-0 top-0 h-16 sm:h-20 bg-gradient-to-b from-[#FAFCFB]/30 to-transparent" />

          {/* Content */}
          <div className="relative z-10 mx-auto max-w-3xl px-4">
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Ready to Begin Your Recovery?
            </h2>

            <p className="mt-4 sm:mt-6 text-base sm:text-lg text-white/85 max-w-xl mx-auto leading-relaxed">
              Join patients and therapists experiencing smarter physical therapy. Track your movement, meet your goals, and regain strength safely.
            </p>

            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3.5 sm:gap-4">
              <Link
                href="/get-started"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-white px-8 py-3.5 sm:px-9 sm:py-4 text-base font-bold text-[#0B4A47] shadow-xl shadow-black/10 transition-all duration-300 hover:scale-105 hover:bg-[#D3F0EC] active:scale-100"
              >
                <span>Get Started Now</span>
                <ArrowRight className="size-5 text-[#0F766E]" />
              </Link>

              <Link
                href="/login/patient"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
              >
                <span>Patient Sign In</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0B4A47] px-4 py-10 sm:px-6 sm:py-12 text-white/80 lg:px-12 border-t border-[#0F766E]/30">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <Link href="/" className="inline-flex items-center gap-2.5 no-underline">
            <MediRehabLogo className="size-8" />
            <span className="text-base font-bold text-white">
              MediRehab<span className="text-[#34D399]"> AI</span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs text-white/70">
            <a href="#home" className="hover:text-white transition-colors">Home</a>
            <a href="#technology" className="hover:text-white transition-colors">About</a>
            <a href="#showcase" className="hover:text-white transition-colors">Services</a>
            <a href="#cta" className="hover:text-white transition-colors">Contact</a>
            <Link href="/get-started" className="hover:text-white transition-colors">Get Started</Link>
          </div>

          <div className="text-xs text-white/60 text-center sm:text-right">
            © {new Date().getFullYear()} MediRehab AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
