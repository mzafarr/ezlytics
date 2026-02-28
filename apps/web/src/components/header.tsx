"use client";
import { BRAND_NAME } from "@my-better-t-app/config/brand";
import Link from "next/link";
import { Activity } from "lucide-react";
import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();

  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  if (pathname === "/") {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between  p-3 md:p-4 border-b-2 border-foreground bg-background">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="p-1 md:p-1.5 bg-amber-500 border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
            <Activity
              className="w-5 h-5 md:w-5 md:h-5 font-bold"
              strokeWidth={2.5}
            />
          </div>
          <span className="text-xl md:text-2xl font-bold uppercase tracking-tight">
            {BRAND_NAME}
          </span>
        </Link>
      </div>
      <div className="hidden md:flex gap-8 text-sm font-semibold uppercase tracking-wide">
        {links.map(({ to, label }) => {
          return (
            <Link
              key={to}
              href={to}
              className="hover:underline decoration-2 underline-offset-4 hover:text-pink-600 transition-colors"
            >
              {label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-4">
        {/* Only leaving User Menu since Dark Mode is forced light in brutalism */}
        <UserMenu />
      </div>
    </nav>
  );
}
