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
      <main className="flex-1 w-full min-w-0 prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-4xl prose-h1:tracking-tighter prose-h2:text-2xl prose-h2:tracking-tight prose-a:text-pink-600 hover:prose-a:text-pink-700 prose-code:bg-muted prose-code:p-1 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-pre:border-2 prose-pre:border-foreground prose-pre:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] prose-pre:bg-zinc-950 prose-pre:text-zinc-50">
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
