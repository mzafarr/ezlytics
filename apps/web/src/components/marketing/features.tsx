"use client";

import {
  ShieldCheck,
  Zap,
  Globe,
  Github,
  Box,
  Layers,
  Code2,
} from "lucide-react";

const features = [
  {
    name: "Privacy First",
    description: "GDPR, CCPA, and PECR compliant. No cookies, just data.",
    icon: ShieldCheck,
    className:
      "lg:col-span-2 lg:row-span-2 bg-gradient-to-br from-indigo-500/10 to-purple-500/10",
  },
  {
    name: "Lightweight",
    description: "< 1kb script. Zero bloat.",
    icon: Zap,
    className: "lg:col-span-1 bg-blue-500/10",
  },
  {
    name: "Real-time",
    description: "Watch traffic as it happens.",
    icon: Globe,
    className: "lg:col-span-1 bg-pink-500/10",
  },
  {
    name: "Open Source",
    description: "Built for the community.",
    icon: Github,
    className: "lg:col-span-2 bg-emerald-500/10",
  },
];

export function Features() {
  return (
    <div className="py-24 sm:py-32 relative">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl sm:text-center mb-16">
          <h2 className="text-base font-semibold leading-7 text-indigo-400">
            Deploy Faster
          </h2>
          <p className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Everything you need. <br />
            <span className="text-muted-foreground">Nothing you don't.</span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:grid-rows-2 h-auto lg:h-[500px]">
          {features.map((feature) => (
            <div
              key={feature.name}
              className={`relative group overflow-hidden rounded-3xl border border-white/5 p-8 flex flex-col justify-between hover:border-white/10 transition-colors ${feature.className}`}
            >
              <div className="absolute inset-0 bg-noise opacity-20 mix-blend-overlay pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none" />

              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 ring-1 ring-white/10 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-6 h-6 text-foreground/80" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground">
                  {feature.name}
                </h3>
                <p className="mt-2 text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
