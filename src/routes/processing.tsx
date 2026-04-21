import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { useMedicalState } from "@/lib/medical-store";

export const Route = createFileRoute("/processing")({
  head: () => ({
    meta: [
      { title: "Analyzing — MedAI" },
      { name: "description", content: "MedAI is running dual-AI analysis on your data." },
    ],
  }),
  component: ProcessingPage,
});

function ProcessingPage() {
  const state = useMedicalState();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.status === "ready") navigate({ to: "/results" });
  }, [state.status, navigate]);

  if (state.status === "idle") {
    return (
      <div className="p-10 text-center">
        <p className="text-muted-foreground">No analysis in progress.</p>
        <Link to="/upload" className="text-primary underline">
          Start one
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-10 py-12 max-w-3xl mx-auto">
      <div className="glass-card rounded-3xl p-8 md:p-12 text-center space-y-8">
        <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full gradient-primary opacity-20 blur-2xl ring-pulse" />
          <div className="absolute inset-3 rounded-full border-4 border-primary/20" />
          <div
            className="absolute inset-3 rounded-full border-4 border-transparent"
            style={{
              borderTopColor: "var(--primary)",
              borderRightColor: "var(--medical)",
              animation: "spin 2s linear infinite",
            }}
          />
          <div className="relative size-20 rounded-2xl gradient-primary text-white flex items-center justify-center shadow-lg float-slow">
            <Activity className="size-9" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold">
            {state.status === "error" ? "Analysis failed" : "Dual-AI analysis in progress"}
          </h1>
          <p className="text-sm text-muted-foreground">{state.stage}</p>
        </div>

        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full gradient-primary transition-all duration-500"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">{state.progress}%</div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-left">
          <ModelCard name="Gemini 2.5 Flash" tone="primary" active={state.status === "processing"} />
          <ModelCard name="GPT-5 mini" tone="medical" active={state.status === "processing"} />
        </div>

        {state.status === "error" && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm p-4 flex items-start gap-2 text-left">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">{state.error}</div>
              <Link to="/upload" className="underline mt-2 inline-block">
                Try again
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ModelCard({ name, tone, active }: { name: string; tone: "primary" | "medical"; active: boolean }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-2">
        <span
          className={`size-2 rounded-full ${tone === "primary" ? "bg-primary" : "bg-medical"} ${active ? "animate-pulse" : ""}`}
        />
        <span className="text-sm font-medium">{name}</span>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{active ? "Reasoning…" : "Idle"}</div>
    </div>
  );
}
