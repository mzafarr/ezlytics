"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { DemoDashboard } from "./demo-dashboard";
import { cn } from "@/lib/utils";

export function Hero() {
  return (
    <section className="relative pt-12 md:pt-24 lg:pt-32 pb-24 lg:pb-32 px-4 overflow-visible">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-500/20 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] -z-10" />

      <div className="container mx-auto flex flex-col items-center text-center gap-8 max-w-5xl z-10 relative">
        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-3 py-1 text-sm font-medium text-foreground/80 ring-1 ring-white/20 hover:bg-white/10 transition-colors cursor-default">
          <Sparkles className="h-3.5 w-3.5 mr-2 text-yellow-400" />
          <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 mr-2 animate-pulse"></span>
          v1.0 is now live
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-foreground drop-shadow-sm">
          Analytics that <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-gradient bg-300%">
            feels inevitable.
          </span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground/80 max-w-2xl leading-relaxed">
          Ezlytics is the open-source analytics platform designed for the modern
          web.
          <span className="text-foreground block mt-1">
            Self-hostable. Privacy-focused. Undeniably beautiful.
          </span>
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center items-center mt-4">
          <Link href="/dashboard/new" className="w-full sm:w-auto group">
            <Button
              size="lg"
              className="w-full sm:w-auto font-medium h-14 px-8 text-base rounded-full shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_-10px_rgba(168,85,247,0.6)] transition-all"
            >
              Get Started{" "}
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link
            href="https://github.com/mzafarr/ezlytics"
            target="_blank"
            className="w-full sm:w-auto"
          >
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto h-14 px-8 text-base rounded-full border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-md"
            >
              Self Host (Docker)
            </Button>
          </Link>
        </div>

        <div className="w-full max-w-xl mx-auto mt-10 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-3xl rounded-full opacity-30 -z-10" />
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-black/40 backdrop-blur-xl rounded-lg border border-white/10 p-1.5 flex items-center gap-2 max-w-sm mx-auto shadow-2xl">
              <div className="pl-3 text-muted-foreground text-sm font-mono flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400/50" />
                ezlytics.com/
              </div>
              <input
                type="text"
                placeholder="your-site"
                className="flex-1 bg-transparent border-none focus:outline-none text-sm h-9 text-foreground placeholder:text-muted-foreground/50"
                disabled
              />
              <Button
                size="sm"
                className="h-8 rounded-md bg-white/10 hover:bg-white/20 border border-white/10"
              >
                Claim
              </Button>
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mt-4 font-mono">
            Free forever for open source
          </p>
        </div>
      </div>

      <div className="container mx-auto mt-24 max-w-7xl px-4 perspective-1000">
        <div className="relative transform transition-all duration-1000 hover:scale-[1.01] hover:rotate-x-1 group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-10 group-hover:opacity-20 transition-opacity duration-500" />
          {/* Added negative margin to pull it up slightly into the glow */}
          <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black/40 backdrop-blur-sm">
            <DemoDashboard />
          </div>
        </div>
      </div>
    </section>
  );
}
