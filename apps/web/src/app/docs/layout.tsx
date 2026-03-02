import { DocsSidebar } from "@/components/docs/sidebar";
import { Menu } from "lucide-react";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row flex-1 w-full max-w-[1400px] mx-auto px-4 md:px-8 py-8 gap-8">
      {/* Mobile Sidebar Toggle (Hidden on Desktop) */}
      <div className="md:hidden w-full flex items-center justify-between border-b-2 border-foreground pb-4">
        <h2 className="font-bold uppercase text-lg tracking-tight">
          Documentation
        </h2>
        <DetailsMenu />
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[250px] shrink-0 sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto border-r-2 border-foreground/10 pr-6">
        <DocsSidebar />
      </aside>

      {/* Main Content Area */}
      <main
        className={[
          "flex-1 w-full min-w-0 max-w-none",
          // Headings
          "[&_h1]:text-4xl [&_h1]:font-black [&_h1]:tracking-tighter [&_h1]:mb-3 [&_h1]:leading-tight",
          "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:border-b-2 [&_h2]:border-foreground/10 [&_h2]:pb-2",
          "[&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-6 [&_h3]:mb-2",
          "[&_h4]:text-base [&_h4]:font-bold [&_h4]:mt-4 [&_h4]:mb-1",
          // Body text
          "[&_p]:text-base [&_p]:leading-7 [&_p]:mb-4 [&_p]:text-foreground/90",
          "[&_hr]:my-8 [&_hr]:border-foreground/15",
          // Lists
          "[&_ul]:mb-5 [&_ul]:pl-6 [&_ul]:space-y-2 [&_ul]:list-disc",
          "[&_ol]:mb-5 [&_ol]:pl-6 [&_ol]:space-y-2 [&_ol]:list-decimal",
          "[&_li]:text-base [&_li]:leading-7 [&_li]:text-foreground/90",
          // Inline code
          "[&_code]:bg-muted [&_code]:text-foreground [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:font-mono [&_code]:border [&_code]:border-foreground/15",
          // Links
          "[&_a]:text-pink-600 [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-pink-700",
          // Strong
          "[&_strong]:font-bold [&_strong]:text-foreground",
        ].join(" ")}
      >
        {children}
      </main>
    </div>
  );
}

// Client component for the mobile details menu so we don't make the whole layout a client component
function DetailsMenu() {
  return (
    <details className="relative group">
      <summary className="list-none cursor-pointer flex items-center justify-center p-2 border-2 border-foreground bg-amber-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
        <Menu className="w-5 h-5" />
      </summary>
      <div className="absolute top-full right-0 mt-2 w-64 bg-background border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 z-50">
        <DocsSidebar />
      </div>
    </details>
  );
}
