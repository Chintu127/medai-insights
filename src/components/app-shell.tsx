import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, Upload, MessageSquare, LayoutDashboard, Moon, Sun, Stethoscope } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/upload", label: "New Analysis", icon: Upload },
  { to: "/results", label: "Results", icon: Activity },
  { to: "/assistant", label: "Assistant", icon: MessageSquare },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme, toggle } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex w-full bg-background text-foreground">
      <aside className="hidden md:flex md:w-64 flex-col border-r border-border bg-sidebar">
        <div className="px-5 py-6 flex items-center gap-3 border-b border-sidebar-border">
          <div className="size-10 rounded-xl gradient-primary flex items-center justify-center text-white shadow-md">
            <Stethoscope className="size-5" />
          </div>
          <div>
            <div className="font-display font-semibold text-lg leading-tight">MedAI</div>
            <div className="text-xs text-muted-foreground">Dual-AI Diagnostics</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-sidebar-accent text-sidebar-foreground"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg gradient-primary flex items-center justify-center text-white">
              <Stethoscope className="size-4" />
            </div>
            <span className="font-display font-semibold">MedAI</span>
          </div>
          <button
            onClick={toggle}
            className="size-9 rounded-lg border border-border flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </header>
        <nav className="md:hidden flex border-b border-border bg-card overflow-x-auto">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex-1 min-w-fit flex items-center justify-center gap-2 px-3 py-2.5 text-xs whitespace-nowrap border-b-2",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-y-auto">{children}</main>
        <footer className="border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground text-center">
          ⚠️ Educational only — not a medical diagnosis. Always consult a licensed clinician.
        </footer>
      </div>
    </div>
  );
}
