"use client";

import { useState } from "react";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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

  const formatPrice = (price: number) => {
    return isYearly ? `$${price}/yr` : `$${price}/mo`;
  };

  return (
    <div className="py-24 sm:py-32 relative overflow-hidden font-sans">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Traffic-based plans to match your growth
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
              <div className="bg-primary text-primary-foreground text-xs font-bold py-1.5 px-4 rounded-lg relative shadow-xl transform -translate-x-1/2 whitespace-nowrap">
                Up to <span className="text-base">{currentTier.label}</span>{" "}
                monthly events
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rotate-45" />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <span className="text-sm font-medium text-muted-foreground min-w-[3ch]">
                10k
              </span>
              <Slider
                defaultValue={[0]}
                max={TRAFFIC_TIERS.length - 1}
                step={1}
                value={[tierIndex]}
                onValueChange={(value) => setTierIndex(value[0])}
                className="flex-1 cursor-grab active:cursor-grabbing [&>[role=slider]]:h-7 [&>[role=slider]]:w-7 [&>[role=slider]]:border-4 [&>[role=slider]]:border-background [&>[role=slider]]:shadow-xl"
              />
              <span className="text-sm font-medium text-muted-foreground min-w-[3ch]">
                10M+
              </span>
            </div>
          </div>

          {/* Billing Switch */}
          <div className="flex items-center justify-center gap-6 relative">
            {/* Handmade arrow SVG */}
            <div className="absolute -top-8 right-[20%] hidden md:block opacity-80 rotate-12">
              <span className="text-primary font-handwriting text-sm block mb-1">
                2 months free
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
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M40 20 L 45 15 L 48 22"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <span
              className={cn(
                "text-base font-medium transition-colors cursor-pointer",
                !isYearly ? "text-foreground" : "text-muted-foreground",
              )}
              onClick={() => setIsYearly(false)}
            >
              Monthly
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="scale-125 data-[state=checked]:bg-primary"
            />
            <span
              className={cn(
                "text-base font-medium transition-colors cursor-pointer",
                isYearly ? "text-foreground" : "text-muted-foreground",
              )}
              onClick={() => setIsYearly(true)}
            >
              Yearly
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid max-w-5xl mx-auto grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Starter Plan */}
          <div className="relative rounded-3xl p-8 xl:p-10 border border-border bg-card/50 backdrop-blur-sm transition-all hover:bg-card/80 hover:border-primary/20 ring-1 ring-border/50">
            <div className="flex items-center justify-between gap-x-4">
              <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">
                STARTER
              </h3>
            </div>
            <p className="mt-6 flex items-baseline gap-x-1">
              <span className="text-6xl font-black tracking-tight text-foreground font-mono">
                $
                {isYearly
                  ? calculatePrice(currentTier.starter).toLocaleString()
                  : currentTier.starter}
              </span>
              <span className="text-sm font-semibold leading-6 text-muted-foreground">
                {isYearly ? "/year" : "/month"}
              </span>
            </p>
            {isYearly && (
              <p className="text-xs text-primary mt-2 font-medium">
                Save ${currentTier.starter * 2}
              </p>
            )}

            <div className="w-full h-px bg-border my-8" />

            <ul className="space-y-4 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-x-3 text-foreground">
                <Check className="h-5 w-5 text-primary shrink-0" />{" "}
                {currentTier.label} monthly events
              </li>
              <li className="flex gap-x-3">
                <Check className="h-5 w-5 text-primary shrink-0" /> 1 Website
              </li>
              <li className="flex gap-x-3">
                <Check className="h-5 w-5 text-primary shrink-0" /> 1 Team
                Member
              </li>
              <li className="flex gap-x-3">
                <Check className="h-5 w-5 text-primary shrink-0" /> 3 Years
                Retention
              </li>
            </ul>
            <Button
              className="mt-8 w-full h-12 text-base font-medium rounded-xl shadow-lg shadow-primary/10"
              variant="default"
            >
              Start 14-day free trial <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <p className="text-xs text-center mt-4 text-muted-foreground/60">
              $0.00 due today. No card required.
            </p>
          </div>

          {/* Growth Plan */}
          <div className="relative rounded-3xl p-8 xl:p-10 border border-primary/50 bg-primary/5 backdrop-blur-sm transition-all hover:bg-primary/10 hover:border-primary ring-1 ring-primary/20">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold leading-5 text-primary-foreground shadow-sm flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Most Popular
            </div>
            <div className="flex items-center justify-between gap-x-4">
              <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">
                GROWTH
              </h3>
            </div>
            <p className="mt-6 flex items-baseline gap-x-1">
              <span className="text-6xl font-black tracking-tight text-foreground font-mono">
                $
                {isYearly
                  ? calculatePrice(currentTier.growth).toLocaleString()
                  : currentTier.growth}
              </span>
              <span className="text-sm font-semibold leading-6 text-muted-foreground">
                {isYearly ? "/year" : "/month"}
              </span>
            </p>
            {isYearly && (
              <p className="text-xs text-primary mt-2 font-medium">
                Save ${currentTier.growth * 2}
              </p>
            )}

            <div className="w-full h-px bg-primary/20 my-8" />

            <ul className="space-y-4 text-sm leading-6 text-muted-foreground">
              <li className="flex gap-x-3 text-foreground">
                <Check className="h-5 w-5 text-primary shrink-0" />{" "}
                {currentTier.label} monthly events
              </li>
              <li className="flex gap-x-3">
                <Check className="h-5 w-5 text-primary shrink-0" /> 30 Websites
              </li>
              <li className="flex gap-x-3">
                <Check className="h-5 w-5 text-primary shrink-0" /> 30 Team
                Members
              </li>
              <li className="flex gap-x-3">
                <Check className="h-5 w-5 text-primary shrink-0" /> 5+ Years
                Retention
              </li>
              <li className="flex gap-x-3">
                <Check className="h-5 w-5 text-primary shrink-0" /> API Access
              </li>
            </ul>
            <Button
              className="mt-8 w-full h-12 text-base font-medium rounded-xl shadow-lg shadow-primary/20"
              size="lg"
            >
              Start 14-day free trial <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
            <p className="text-xs text-center mt-4 text-muted-foreground/60">
              $0.00 due today. No card required.
            </p>
          </div>
        </div>

        {/* Open Source / Community Plan */}
        <div className="mt-20 max-w-2xl mx-auto text-center pt-12">
          <h3 className="text-xl font-medium text-foreground">
            Not ready for Cloud?
          </h3>
          <Button
            asChild
            variant="link"
            className="mt-2 text-muted-foreground hover:text-foreground"
          >
            <a href="https://github.com/ralph/ezlytics" target="_blank">
              Explore Open Source Edition &rarr;
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
