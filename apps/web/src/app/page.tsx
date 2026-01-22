"use client";

import { Features } from "@/components/marketing/features";
import { Hero } from "@/components/marketing/hero";
import { Pricing } from "@/components/marketing/pricing";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <Hero />
      <Features />
      <Pricing />

      <footer className="py-12 px-6 border-t bg-muted/20">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-muted-foreground">
          <div>
            © {new Date().getFullYear()} Ezlytics. Open Source Apache-2.0.
          </div>
          <div className="flex gap-6">
            <a
              href="https://github.com/ralph/ezlytics"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a href="/docs" className="hover:text-foreground transition-colors">
              Documentation
            </a>
            <a
              href="/login"
              className="hover:text-foreground transition-colors"
            >
              Login
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
