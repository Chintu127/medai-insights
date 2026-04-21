import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ShieldCheck, Sparkles, Upload, MessageSquare, FlaskConical, GitCompare } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MedAI — Dual-AI Medical Analysis Dashboard" },
      {
        name: "description",
        content: "Upload lab reports and symptoms — get a dual-AI second opinion from Gemini and GPT, side-by-side.",
      },
      { property: "og:title", content: "MedAI — Dual-AI Medical Analysis" },
      {
        property: "og:description",
        content: "Educational dual-AI medical analysis dashboard powered by Lovable AI.",
      },
    ],
  }),
  component: HomePage,
});

const features = [
  {
    icon: GitCompare,
    title: "Dual-AI Verification",
    desc: "Gemini and GPT analyze independently. A comparison engine scores their agreement.",
  },
  {
    icon: FlaskConical,
    title: "Lab Report Vision",
    desc: "Upload photos or PDFs of lab reports — the AI reads values directly.",
  },
  {
    icon: ShieldCheck,
    title: "Safety-First Output",
    desc: "Possible conditions, not diagnoses. Confidence scores and clear warnings on every result.",
  },
];

function HomePage() {
  return (
    <div className="px-4 md:px-10 py-8 md:py-12 max-w-6xl mx-auto space-y-12">
      <section className="relative rounded-3xl overflow-hidden gradient-hero text-white p-8 md:p-14 shadow-xl">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,white_0%,transparent_40%),radial-gradient(circle_at_80%_70%,white_0%,transparent_40%)] pointer-events-none" />
        <div className="relative max-w-2xl space-y-5">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur text-xs font-medium">
            <Sparkles className="size-3.5" /> Educational research prototype
          </span>
          <h1 className="font-display text-3xl md:text-5xl font-semibold leading-tight">
            A dual-AI second opinion on your lab report.
          </h1>
          <p className="text-white/85 text-base md:text-lg">
            MedAI runs two state-of-the-art models in parallel, extracts your lab values, ranks
            possible conditions, and shows you exactly where the AIs agree and disagree.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-5 h-12 rounded-xl bg-white text-primary font-medium hover:bg-white/95 transition shadow-lg"
            >
              <Upload className="size-4" /> Start a new analysis
            </Link>
            <Link
              to="/assistant"
              className="inline-flex items-center gap-2 px-5 h-12 rounded-xl bg-white/15 backdrop-blur text-white font-medium border border-white/20 hover:bg-white/25 transition"
            >
              <MessageSquare className="size-4" /> Ask the assistant
            </Link>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-4">
        {features.map((f) => (
          <div key={f.title} className="glass-card rounded-2xl p-6 space-y-3">
            <div className="size-11 rounded-xl gradient-primary text-white flex items-center justify-center">
              <f.icon className="size-5" />
            </div>
            <h3 className="font-display text-lg font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      <section className="glass-card rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6">
        <div className="size-14 shrink-0 rounded-2xl bg-medical/20 text-medical flex items-center justify-center">
          <Activity className="size-7" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-xl font-semibold">How it works</h3>
          <p className="text-sm text-muted-foreground mt-1">
            1. Enter patient profile + symptoms · 2. Upload lab report (image or text) · 3. Both
            AIs analyze in parallel · 4. Comparison engine produces a final confidence score.
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center justify-center px-5 h-11 rounded-xl gradient-primary text-white font-medium glow whitespace-nowrap"
        >
          Begin analysis
        </Link>
      </section>
    </div>
  );
}
