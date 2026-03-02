"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BookOpen, Code, LayoutDashboard } from "lucide-react";

const navItems = [
  {
    title: "Getting Started",
    icon: BookOpen,
    items: [
      {
        title: "Quickstart",
        href: "/docs",
      },
    ],
  },
  {
    title: "Integration Guides",
    icon: Code,
    items: [
      {
        title: "HTML / Script Tag",
        href: "/docs/html",
      },
      {
        title: "React / Next.js",
        href: "/docs/react",
      },
    ],
  },
  {
    title: "Platform Features",
    icon: LayoutDashboard,
    items: [
      {
        title: "Features & Reference",
        href: "/docs/features",
      },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-full flex flex-col gap-6">
      {navItems.map((section, index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-2 py-1">
            <section.icon className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h4>
          </div>
          <ul className="flex flex-col gap-1">
            {section.items.map((item, itemIndex) => {
              const isActive = pathname === item.href;
              return (
                <li key={itemIndex}>
                  <Link
                    href={item.href as any}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 text-sm font-medium rounded-md transition-colors",
                      isActive
                        ? "bg-amber-500 text-foreground border-2 border-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
