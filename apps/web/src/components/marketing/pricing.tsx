"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

const TRAFFIC_TIERS = [
  { value: "10k", label: "10k", starter: 9, growth: 19 },
  { value: "100k", label: "100k", starter: 19, growth: 39 },
  { value: "200k", label: "200k", starter: 29, growth: 59 },
  { value: "500k", label: "500k", starter: 49, growth: 99 },
  { value: "1M", label: "1M", starter: 69, growth: 129 },
  { value: "2M", label: "2M", starter: 99, growth: 199 },
  { value: "5M", label: "5M", starter: 129, growth: 259 },
  { value: "10M", label: "10M", starter: 169, growth: 329 },
  { value: "10M+", label: "10M+", starter: 199, growth: 399 },
];

export function Pricing() {
  const [tierIndex, setTierIndex] = useState(0);
  const [isYearly, setIsYearly] = useState(false);

  const currentTier = TRAFFIC_TIERS[tierIndex];

  const calculatePrice = (basePrice: number) => {
    return isYearly ? basePrice * 10 : basePrice; // 2 months free = 10 months billing
  };

  return (
    <div className="py-24 sm:py-32 relative overflow-hidden bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-sm font-bold uppercase tracking-widest text-primary mb-3">
            Pricing
          </p>
          <h2 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
            Traffic-based plans
            <br />
            <span className="text-muted-foreground font-black">
              to match your growth.
            </span>
          </h2>
        </div>

        {/* Controls */}
        <div className="max-w-3xl mx-auto mb-20 space-y-12">
          {/* Slider Section */}
          <div className="space-y-8 relative">
            {/* Floating Badge */}
            <div
              className="absolute -top-12 left-0 w-full flex justify-center lg:justify-start lg:pl-[20%] transition-all duration-300"
              style={{
                paddingLeft: `${(tierIndex / (TRAFFIC_TIERS.length - 1)) * 80}%`,
              }}
            >
              <div className="bg-primary text-primary-foreground text-xs font-black py-1.5 px-4 border-2 border-black shadow-[4px_4px_0px_0px_#000] relative transform -translate-x-1/2 whitespace-nowrap uppercase tracking-wider">
                Up to <span className="text-base">{currentTier.label}</span>{" "}
                monthly events
                <div className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3 h-3 bg-primary border-b-2 border-r-2 border-black rotate-45" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <span className="text-sm font-bold text-muted-foreground min-w-[3ch] font-mono">
                10k
              </span>
              <Slider
                defaultValue={[0]}
                max={TRAFFIC_TIERS.length - 1}
                step={1}
                value={[tierIndex]}
                onValueChange={(value) => setTierIndex(value[0])}
                className="flex-1 cursor-grab active:cursor-grabbing [&>[role=slider]]:h-7 [&>[role=slider]]:w-7 [&>[role=slider]]:border-2 [&>[role=slider]]:border-black [&>[role=slider]]:shadow-[3px_3px_0px_0px_#000] [&>[role=slider]]:rounded-none"
              />
              <span className="text-sm font-bold text-muted-foreground min-w-[3ch] font-mono">
                10M+
              </span>
            </div>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 relative">
            {/* Handmade arrow pointing to yearly */}
            <div className="absolute -top-8 right-[20%] hidden md:block opacity-80 rotate-12">
              <span className="text-primary font-bold text-sm block mb-1">
                2 months free!
              </span>
              <svg
                width="40"
                height="20"
                viewBox="0 0 50 30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-primary"
              >
                <path
                  d="M5 5 C 15 25, 35 25, 45 15"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M40 20 L 45 15 L 48 22"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="flex items-center border-2 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
              <button
                onClick={() => setIsYearly(false)}
                className={cn(
                  "px-6 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors",
                  !isYearly
                    ? "bg-foreground text-background"
                    : "bg-background text-foreground hover:bg-muted",
                )}
              >
                Monthly
              </button>
              <div className="w-px h-full bg-black" />
              <button
                onClick={() => setIsYearly(true)}
                className={cn(
                  "px-6 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2",
                  isYearly
                    ? "bg-foreground text-background"
                    : "bg-background text-foreground hover:bg-muted",
                )}
              >
                Yearly
                <span
                  className={cn(
                    "text-xs font-black px-1.5 py-0.5 border border-current",
                    isYearly
                      ? "border-background"
                      : "border-primary text-primary",
                  )}
                >
                  -17%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid max-w-5xl mx-auto grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Starter Plan */}
          <div className="relative border-2 border-black bg-card shadow-[8px_8px_0px_0px_#000] p-8 xl:p-10 transition-all hover:shadow-[12px_12px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5">
            <div className="flex items-center justify-between gap-x-4 mb-2">
              <h3 className="text-xs font-black tracking-widest text-muted-foreground uppercase">
                Starter
              </h3>
            </div>

            <p className="mt-4 flex items-end gap-x-2">
              <span className="text-6xl font-black tracking-tight text-foreground font-mono">
                $
                {isYearly
                  ? calculatePrice(currentTier.starter).toLocaleString()
                  : currentTier.starter}
              </span>
              <span className="text-sm font-bold text-muted-foreground mb-2">
                {isYearly ? "/year" : "/month"}
              </span>
            </p>
            {isYearly && (
              <p className="text-xs text-primary mt-1 font-black uppercase tracking-wider">
                Save ${currentTier.starter * 2}
              </p>
            )}

            <div className="w-full h-0.5 bg-black my-8" />

            <ul className="space-y-4 text-sm leading-6">
              <li className="flex gap-x-3 items-center font-semibold text-foreground">
                <Check className="h-4 w-4 text-primary shrink-0 stroke-[3]" />
                {currentTier.label} monthly events
              </li>
              <li className="flex gap-x-3 items-center text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0 stroke-[3]" />1
                Website
              </li>
              <li className="flex gap-x-3 items-center text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0 stroke-[3]" />1
                Team Member
              </li>
              <li className="flex gap-x-3 items-center text-muted-foreground">
                <Check className="h-4 w-4 text-primary shrink-0 stroke-[3]" />3
                Years Retention
              </li>
            </ul>

            <Button
              asChild
              className="mt-8 w-full h-12 text-base font-black uppercase tracking-wider rounded-none border-2 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
              variant="outline"
            >
              <Link href="/dashboard/new">
                Start Free Trial{" "}
                <ArrowRight className="ml-2 w-4 h-4 stroke-[3]" />
              </Link>
            </Button>
            <p className="text-xs text-center mt-4 text-muted-foreground font-medium">
              $0.00 due today. No card required.
            </p>
          </div>

          {/* Growth Plan */}
          <div className="relative border-2 border-black bg-foreground shadow-[8px_8px_0px_0px_#000] p-8 xl:p-10 transition-all hover:shadow-[12px_12px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5">

            <div className="flex items-center justify-between gap-x-4 mb-2">
              <h3 className="text-xs font-black tracking-widest text-background/60 uppercase">
                Growth
              </h3>
            </div>

            <p className="mt-4 flex items-end gap-x-2">
              <span className="text-6xl font-black tracking-tight text-background font-mono">
                $
                {isYearly
                  ? calculatePrice(currentTier.growth).toLocaleString()
                  : currentTier.growth}
              </span>
              <span className="text-sm font-bold text-background/60 mb-2">
                {isYearly ? "/year" : "/month"}
              </span>
            </p>
            {isYearly && (
              <p className="text-xs text-primary mt-1 font-black uppercase tracking-wider">
                Save ${currentTier.growth * 2}
              </p>
            )}

            <div className="w-full h-0.5 bg-background/30 my-8" />

            <ul className="space-y-4 text-sm leading-6">
              <li className="flex gap-x-3 items-center font-semibold text-background">
                <Check className="h-4 w-4 text-primary shrink-0 stroke-[3]" />
                {currentTier.label} monthly events
              </li>
              <li className="flex gap-x-3 items-center text-background/70">
                <Check className="h-4 w-4 text-primary shrink-0 stroke-[3]" />
                30 Websites
              </li>
              <li className="flex gap-x-3 items-center text-background/70">
                <Check className="h-4 w-4 text-primary shrink-0 stroke-[3]" />
                30 Team Members
              </li>
              <li className="flex gap-x-3 items-center text-background/70">
                <Check className="h-4 w-4 text-primary shrink-0 stroke-[3]" />
                5+ Years Retention
              </li>
              <li className="flex gap-x-3 items-center text-background/70">
                <Check className="h-4 w-4 text-primary shrink-0 stroke-[3]" />
                API Access
              </li>
            </ul>

            <Button
              asChild
              className="mt-8 w-full h-12 text-base font-black uppercase tracking-wider rounded-none border-2 border-background bg-background text-foreground hover:bg-background/90 shadow-[4px_4px_0px_0px_rgba(244,244,240,0.4)] hover:shadow-[6px_6px_0px_0px_rgba(244,244,240,0.4)] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all"
              size="lg"
            >
              <Link href="/dashboard/new">
                Start Free Trial{" "}
                <ArrowRight className="ml-2 w-4 h-4 stroke-[3]" />
              </Link>
            </Button>
            <p className="text-xs text-center mt-4 text-background/50 font-medium">
              $0.00 due today. No card required.
            </p>
          </div>
        </div>

        {/* Open Source / Community Plan */}
        <div className="mt-20 max-w-2xl mx-auto text-center pt-12 border-t-2 border-dashed border-border">
          <h3 className="text-lg font-black text-foreground uppercase tracking-wide">
            Not ready for Cloud?
          </h3>
          <p className="text-muted-foreground text-sm mt-2 font-medium">
            Self-host with Docker for free, forever.
          </p>
          <a
            href="https://github.com/mzafarr/ezlytics"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-sm font-black uppercase tracking-widest text-foreground border-2 border-black px-5 py-2.5 shadow-[4px_4px_0px_0px_#000] hover:shadow-[6px_6px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all bg-background"
          >
            Explore Open Source Edition →
          </a>
        </div>
      </div>
    </div>
  );
}
