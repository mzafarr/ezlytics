"use client";

import React, { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Database,
  PieChart,
  Users,
  Zap,
  Check,
  TrendingUp,
} from "lucide-react";
import { DemoDashboard } from "@/components/marketing/demo-dashboard";
import { Pricing } from "@/components/marketing/pricing";
import { authClient } from "@/lib/auth-client";
import { env } from "@my-better-t-app/env/web";

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const ossOnly = env.NEXT_PUBLIC_OSS_ONLY === "true";
  const { data: session, isPending } = authClient.useSession();

  return (
    <div className="min-h-screen bg-[#f4f4f0] text-black font-sans selection:bg-pink-400 selection:text-black overflow-x-hidden">
      {/* Navigation */}
      <nav className="border-b-4 border-black bg-[#ffde59]/10">
        <div className="sticky top-0 z-50 flex items-center justify-between p-4 md:p-6 max-w-7xl mx-auto ">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/70 border-4 border-black shadow-[4px_4px_0px_0px_black]">
              <Activity
                className="w-6 h-6 md:w-8 md:h-8 font-black"
                strokeWidth={3}
              />
            </div>
            <span className="text-2xl md:text-3xl font-black uppercase tracking-tighter">
              Ezlytics
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8 font-bold text-lg uppercase tracking-wide">
            <a
              href="#features"
              className="hover:underline decoration-4 underline-offset-4 hover:text-pink-600 transition-colors"
            >
              Features
            </a>
            {!ossOnly && (
              <a
                href="#pricing"
                className="hover:underline decoration-4 underline-offset-4 hover:text-pink-600 transition-colors"
              >
                Pricing
              </a>
            )}
            <a
              href="/docs"
              className="hover:underline decoration-4 underline-offset-4 hover:text-pink-600 transition-colors"
            >
              Docs
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            {isPending ? (
              <div className="h-10 w-24 bg-black/10 animate-pulse border-4 border-black"></div>
            ) : session ? (
              <Link
                href="/dashboard"
                className="px-6 py-2 flex items-center justify-center font-bold text-lg uppercase bg-white border-4 border-black shadow-[4px_4px_0px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200"
              >
                Dashboard
              </Link>
            ) : ossOnly ? (
              <a
                href="https://github.com/mzafarr/ezlytics"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2 flex items-center justify-center font-bold text-lg uppercase bg-white border-4 border-black shadow-[4px_4px_0px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200"
              >
                GitHub
              </a>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-6 py-2 flex items-center justify-center font-bold text-lg uppercase bg-white border-4 border-black shadow-[4px_4px_0px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200"
                >
                  Login
                </Link>
                <Link
                  href="/dashboard/new"
                  className="px-6 py-2 flex items-center justify-center font-bold text-lg uppercase text-white bg-black border-4 border-black shadow-[4px_4px_0px_0px_black] hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all duration-200"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 bg-white border-4 border-black shadow-[4px_4px_0px_0px_black] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <div className="w-6 h-1 bg-black mb-1"></div>
            <div className="w-6 h-1 bg-black mb-1"></div>
            <div className="w-6 h-1 bg-black"></div>
          </button>
        </div>
      </nav>
      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="md:hidden border-b-4 border-black bg-white p-6 flex flex-col gap-4 font-bold uppercase text-xl">
          <a href="#features" className="border-b-2 border-black pb-2">
            Features
          </a>
          {!ossOnly && (
            <a href="#pricing" className="border-b-2 border-black pb-2">
              Pricing
            </a>
          )}
          {session ? (
            <Link
              href="/dashboard"
              className="w-full flex justify-center py-3 mt-4 bg-[#ffde59] border-4 border-black shadow-[4px_4px_0px_0px_black]"
            >
              Dashboard
            </Link>
          ) : ossOnly ? (
            <a
              href="https://github.com/mzafarr/ezlytics"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex justify-center py-3 mt-4 bg-[#ffde59] border-4 border-black shadow-[4px_4px_0px_0px_black]"
            >
              GitHub →
            </a>
          ) : (
            <Link
              href="/dashboard/new"
              className="w-full flex justify-center py-3 mt-4 bg-[#ffde59] border-4 border-black shadow-[4px_4px_0px_0px_black]"
            >
              Sign Up Now
            </Link>
          )}
        </div>
      )}

      {/* Hero Section */}
      <header className="py-16 px-4 md:py-32 flex justify-between gap-8 max-w-7xl mx-auto">
        <div className="space-y-8 relative z-10">
          <div className="inline-block px-4 py-2 bg-[#ff914d] border-4 border-black shadow-[2.5px_2.5px_0px_0px_black] transform -rotate-2 font-bold uppercase tracking-wider mb-6">
            The Open-Source Revenue Analytics
          </div>
          <h1 className="text-6xl md:text-8xl font-black leading-[0.9] uppercase tracking-tighter">
            Revenue-first <br />
            <span className="bg-[#38b6ff] px-2 border-4 border-black shadow-[6px_6px_0px_0px_black] inline-block transform rotate-1 mt-4">
              analytics.
            </span>
          </h1>
          <p className="text-xl md:text-2xl font-bold max-w-lg border-l-8 border-black pl-6 py-2 bg-white/50">
            Discover which marketing channels bring customers so you can grow
            your business, fast.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 pt-4">
            {session ? (
              <Link
                href="/dashboard"
                className="group flex items-center justify-center gap-3 px-8 py-4 text-xl font-black uppercase text-black bg-[#cb6ce6] border-4 border-black shadow-[8px_8px_0px_0px_black] hover:translate-x-[8px] hover:translate-y-[8px] hover:shadow-none transition-all duration-200"
              >
                Go to Dashboard{" "}
                <ArrowRight
                  className="w-6 h-6 group-hover:translate-x-2 transition-transform"
                  strokeWidth={3}
                />
              </Link>
            ) : !ossOnly ? (
              <Link
                href="/dashboard/new"
                className="group flex items-center justify-center gap-3 px-8 py-4 text-xl font-black uppercase text-black bg-[#cb6ce6] border-4 border-black shadow-[8px_8px_0px_0px_black] hover:translate-x-[8px] hover:translate-y-[8px] hover:shadow-none transition-all duration-200"
              >
                Start Free Trial{" "}
                <ArrowRight
                  className="w-6 h-6 group-hover:translate-x-2 transition-transform"
                  strokeWidth={3}
                />
              </Link>
            ) : null}
            <a
              href="https://github.com/mzafarr/ezlytics"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 flex justify-center text-xl font-black uppercase bg-white border-4 border-black shadow-[8px_8px_0px_0px_black] hover:translate-x-[8px] hover:translate-y-[8px] hover:shadow-none transition-all duration-200"
            >
              GitHub
            </a>
          </div>
        </div>

        {/* Hero Visual - Code Snippet Card */}
        <div className="relative flex flex-col gap-8 transform md:rotate-1 hover:rotate-0 transition-transform duration-300">
          {/* Card */}
          <div className="border-4 border-black bg-neutral-950 shadow-[12px_12px_0px_0px_black] overflow-hidden">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a1a] border-b-4 border-black">
              <div className="w-3 h-3 rounded-full bg-[#ff5757] border-2 border-black"></div>
              <div className="w-3 h-3 rounded-full bg-[#ffde59] border-2 border-black"></div>
              <div className="w-3 h-3 rounded-full bg-[#00bf63] border-2 border-black"></div>
              {/* <span className="ml-2 text-xs font-bold text-white/40 uppercase tracking-widest">install.html</span> */}
            </div>
            {/* Code */}
            <div className="p-6 md:p-8 font-mono text-sm md:text-base leading-relaxed">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
                // Step 1 — paste this before &lt;/body&gt;
              </p>
              <p className="text-[#ffde59]">
                <span className="text-white/50">&lt;</span>
                <span className="text-[#38b6ff]">script</span>
              </p>
              <p className="pl-6 text-[#00bf63]">
                src=
                <span className="text-[#ff914d]">
                  &quot;https://ezlytics.com/js/script.js&quot;
                </span>
              </p>
              <p className="pl-6 text-[#00bf63]">
                website-id=
                <span className="text-[#ff914d]">&quot;YOUR_SITE_ID&quot;</span>
              </p>
              <p className="pl-6 text-[#00bf63]">
                api-key=
                <span className="text-[#ff914d]">&quot;YOUR_API_KEY&quot;</span>
              </p>
              <p className="text-white/50">
                &gt;&lt;/<span className="text-[#38b6ff]">script</span>&gt;
              </p>
              <p className="mt-6 text-white/40 text-xs uppercase tracking-widest">
                // That&apos;s it. Seriously.
              </p>
            </div>
          </div>

          {/* Stat badges row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-[#00bf63] border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_black] font-black uppercase text-sm">
              <Check className="w-4 h-4" strokeWidth={3} /> ~6kb script
            </div>
            <div className="flex items-center gap-2 bg-[#ffde59] border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_black] font-black uppercase text-sm">
              <Check className="w-4 h-4" strokeWidth={3} /> MIT License
            </div>
            <div className="flex items-center gap-2 bg-white border-4 border-black px-4 py-2 shadow-[4px_4px_0px_0px_black] font-black uppercase text-sm">
              <TrendingUp className="w-4 h-4" strokeWidth={3} /> Revenue-aware
            </div>
          </div>
        </div>
      </header>

      {/* Marquee Section */}
      <div className="w-full bg-black text-white py-4 overflow-hidden border-y-4 border-black flex items-center">
        <div className="whitespace-nowrap animate-marquee flex gap-8 items-center font-black text-2xl md:text-4xl uppercase tracking-widest">
          <span>OPEN SOURCE ANALYTICS</span>
          <span className="text-[#ffde59]">★</span>
          <span>OWN YOUR DATA</span>
          <span className="text-[#ffde59]">★</span>
          <span>REVENUE FOCUSED</span>
          <span className="text-[#ffde59]">★</span>
          <span>OPEN SOURCE ANALYTICS</span>
          <span className="text-[#ffde59]">★</span>
          <span>OWN YOUR DATA</span>
          <span className="text-[#ffde59]">★</span>
        </div>
      </div>

      {/* Demo Section */}
      <section className="py-24 px-4 bg-[#ffde59] border-b-4 border-black overflow-hidden relative">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#000 2px, transparent 2px)",
            backgroundSize: "20px 20px",
          }}
        ></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col items-center text-center mb-16">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-4 bg-white px-6 py-2 border-4 border-black shadow-[8px_8px_0px_0px_black] transform rotate-1">
              See it in action.
            </h2>
          </div>
          <div className="border-4 border-black shadow-[16px_16px_0px_0px_black] bg-white">
            <DemoDashboard />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-24 px-4 bg-[#f4f4f0] border-b-4 border-black">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6 bg-white px-6 py-2 border-4 border-black shadow-[8px_8px_0px_0px_black] transform -rotate-1">
              How it works?
            </h2>
            <p className="text-2xl font-bold bg-[#ffde59] border-4 border-black inline-block px-6 py-3 shadow-[6px_6px_0px_0px_black] transform rotate-1">
              Find revenue opportunities in 3 steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 mt-8">
            {/* Step 1 */}
            <div className="border-4 border-black p-8 bg-white shadow-[12px_12px_0px_0px_black] relative hover:-translate-y-2 transition-transform duration-300">
              <div className="absolute -top-8 -left-8 w-16 h-16 bg-[#00bf63] border-4 border-black flex items-center justify-center text-4xl font-black shadow-[4px_4px_0px_0px_black] transform -rotate-6">
                1
              </div>
              <p className="font-bold text-xs uppercase tracking-widest text-gray-400 mt-4 mb-2">
                ~1 minute
              </p>
              <h3 className="text-3xl font-black uppercase mb-4">
                Paste 1 line of JS
              </h3>
              <p className="font-bold text-lg text-gray-800">
                Drop the script before your closing{" "}
                <code className="bg-gray-100 px-1 border-2 border-black text-sm">
                  &lt;/body&gt;
                </code>{" "}
                tag and you&apos;re collecting data instantly.
              </p>
            </div>
            {/* Step 2 */}
            <div className="border-4 border-black p-8 bg-white shadow-[12px_12px_0px_0px_black] relative hover:-translate-y-2 transition-transform duration-300 md:mt-12">
              <div className="absolute -top-8 -left-8 w-16 h-16 bg-[#38b6ff] border-4 border-black flex items-center justify-center text-4xl font-black shadow-[4px_4px_0px_0px_black] transform rotate-3">
                2
              </div>
              <p className="font-bold text-xs uppercase tracking-widest text-gray-400 mt-4 mb-2">
                30 seconds
              </p>
              <h3 className="text-3xl font-black uppercase mb-4">
                Link Stripe/LS
              </h3>
              <p className="font-bold text-lg text-gray-800">
                Connect your payment processor in one click. We map every
                transaction back to the exact traffic source that drove it.
              </p>
            </div>
            {/* Step 3 */}
            <div className="border-4 border-black p-8 bg-white shadow-[12px_12px_0px_0px_black] relative hover:-translate-y-2 transition-transform duration-300 md:mt-24">
              <div className="absolute -top-8 -left-8 w-16 h-16 bg-[#cb6ce6] border-4 border-black flex items-center justify-center text-4xl font-black shadow-[4px_4px_0px_0px_black] transform -rotate-3">
                3
              </div>
              <p className="font-bold text-xs uppercase tracking-widest text-gray-400 mt-4 mb-2">
                Ongoing
              </p>
              <h3 className="text-3xl font-black uppercase mb-4">
                See what pays
              </h3>
              <p className="font-bold text-lg text-gray-800">
                Know exactly which blog post, ad, or tweet made someone a paying
                customer — and double down on what works.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section
        id="features"
        className="bg-[#ff914d] py-24 border-b-4 border-black"
      >
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col items-center mb-16 text-center">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter bg-white px-6 py-2 border-4 border-black shadow-[8px_8px_0px_0px_black] transform -rotate-1">
              Features
            </h2>
            <p className="mt-8 text-2xl font-bold max-w-2xl bg-black text-white p-4 border-4 border-black transform rotate-1">
              Everything you need to scale. Nothing you don't.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 pt-8">
            <FeatureCard
              icon={<Zap className="w-12 h-12" strokeWidth={2.5} />}
              title="Real-Time Sync"
              desc="Your data updates instantly. No refreshing, no waiting around for crons to run."
              color="bg-[#ffde59]"
            />
            <FeatureCard
              icon={<Database className="w-12 h-12" strokeWidth={2.5} />}
              title="1-Click Export"
              desc="Download your data instantly. Export daily stats or full breakdowns as CSV or JSON directly from your dashboard."
              color="bg-[#00bf63]"
            />
            <FeatureCard
              icon={<Activity className="w-12 h-12" strokeWidth={2.5} />}
              title="Super Fast Script"
              desc="Only ~6kb gzipped. Won't slow down your site and respects your users' bandwidth."
              color="bg-[#38b6ff]"
            />
            <FeatureCard
              icon={<TrendingUp className="w-12 h-12" strokeWidth={2.5} />}
              title="Revenue Tracking"
              desc="Attribute every dollar to the exact marketing channel that brought the customer in."
              color="bg-white"
            />
            <FeatureCard
              icon={<PieChart className="w-12 h-12" strokeWidth={2.5} />}
              title="Funnel Analysis"
              desc="Identify exactly where users drop off and patch the leaky buckets in your flow."
              color="bg-[#cb6ce6]"
            />
            <FeatureCard
              icon={<Users className="w-12 h-12" strokeWidth={2.5} />}
              title="Fully Open Source"
              desc="Host it yourself. You own 100% of your data and can inspect every line of code."
              color="bg-[#ff5757]"
            />
          </div>
        </div>
      </section>

      {!ossOnly && (
        <section id="pricing" className="bg-[#f4f4f0] border-b-4 border-black">
          <Pricing />
        </section>
      )}

      {/* Footer CTA */}
      <footer className="py-32 px-4 text-center bg-[#38b6ff] border-t-4 border-black relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-[#ffde59] rounded-full border-4 border-black shadow-[8px_8px_0px_0px_black] animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-24 h-24 bg-[#ff5757] border-4 border-black shadow-[8px_8px_0px_0px_black] rotate-45"></div>

        <div className="max-w-3xl mx-auto relative z-10 flex flex-col items-center">
          {ossOnly ? (
            <>
              <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-8 bg-black text-white inline-block p-4 transform -rotate-2">
                100% Open Source.
              </h2>
              <p className="text-2xl font-bold mb-12 bg-white px-6 py-2 border-4 border-black inline-block shadow-[6px_6px_0px_0px_black]">
                Self-host & own your data forever.
              </p>
              <a
                href="https://github.com/mzafarr/ezlytics"
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl md:text-4xl px-12 py-6 font-black uppercase bg-[#00bf63] border-4 border-black shadow-[12px_12px_0px_0px_black] hover:translate-x-[12px] hover:translate-y-[12px] hover:shadow-none transition-all duration-200"
              >
                View on GitHub →
              </a>
              <p className="mt-6 font-bold uppercase tracking-wider text-black/70">
                Free forever. MIT License.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter mb-8 bg-black text-white inline-block p-4 transform -rotate-2">
                Ready to crush it?
              </h2>
              <p className="text-2xl font-bold mb-12 bg-white px-6 py-2 border-4 border-black inline-block shadow-[6px_6px_0px_0px_black]">
                Join 10,000+ companies making data-driven decisions.
              </p>
              <Link
                href={session ? "/dashboard" : "/dashboard/new"}
                className="text-2xl md:text-4xl px-12 py-6 font-black uppercase bg-[#00bf63] border-4 border-black shadow-[12px_12px_0px_0px_black] hover:translate-x-[12px] hover:translate-y-[12px] hover:shadow-none transition-all duration-200"
              >
                {session ? "Go to Dashboard" : "Get Started Free"}
              </Link>
              <p className="mt-6 font-bold uppercase tracking-wider text-black/70">
                No credit card required. Cancel anytime.
              </p>
            </>
          )}
        </div>
      </footer>

      {/* Tiny Footer */}
      <div className="bg-black text-white text-center py-6 font-bold uppercase tracking-widest text-sm border-t-4 border-black">
        © {new Date().getFullYear()} Ezlytics | Open Source MIT.
      </div>
    </div>
  );
}

// Reusable Feature Card Component
const FeatureCard = ({
  icon,
  title,
  desc,
  color,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  color: string;
}) => {
  return (
    <div
      className={`
      ${color} border-4 border-black p-8 
      shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] 
      hover:translate-x-[8px] hover:translate-y-[8px] hover:shadow-none 
      transition-all duration-200 flex flex-col h-full
    `}
    >
      <div className="mb-6 bg-white w-20 h-20 flex items-center justify-center border-4 border-black shadow-[4px_4px_0px_0px_black]">
        {icon}
      </div>
      <h3 className="text-3xl font-black uppercase tracking-tight mb-4">
        {title}
      </h3>
      <p className="text-lg font-bold leading-snug">{desc}</p>
    </div>
  );
};
