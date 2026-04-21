import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  HeartPulse,
  Pill,
  Stethoscope,
} from "lucide-react";
import { useMedicalState } from "@/lib/medical-store";
import type { AIAnalysisResult } from "@/lib/medical-types";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results — MedAI" },
      { name: "description", content: "Dual-AI possible conditions, lab values, risk and confidence." },
    ],
  }),
  component: ResultsPage,
});

function pickRisk(level: string | undefined): "low" | "medium" | "high" {
  const v = (level ?? "").toLowerCase();
  if (v.includes("high") || v.includes("critical")) return "high";
  if (v.includes("med")) return "medium";
  return "low";
}

function ResultsPage() {
  const { result, status } = useMedicalState();

  if (!result) {
    return (
      <div className="px-4 md:px-10 py-16 max-w-3xl mx-auto text-center space-y-3">
        <div className="size-14 rounded-2xl gradient-primary text-white mx-auto flex items-center justify-center">
          <Activity className="size-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold">No results yet</h1>
        <p className="text-sm text-muted-foreground">
          {status === "processing" ? "Analysis still running…" : "Run an analysis to see your dual-AI report here."}
        </p>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 px-5 h-11 rounded-xl gradient-primary text-white font-medium glow"
        >
          Start a new analysis <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  const { gemini, gpt, comparison } = result;
  const confidence = Number(comparison.confidence_score?.toString().replace(/[^0-9.]/g, "")) || 0;
  const risk = pickRisk(gemini.risk_level || gpt.risk_level);

  return (
    <div className="px-4 md:px-10 py-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Analysis Report</h1>
          <p className="text-sm text-muted-foreground">
            Dual-AI verification by Gemini and GPT — possible conditions, not a diagnosis.
          </p>
        </div>
        <Link
          to="/upload"
          className="text-sm inline-flex items-center gap-1.5 px-4 h-10 rounded-lg border border-border hover:bg-muted"
        >
          New analysis <ArrowRight className="size-4" />
        </Link>
      </header>

      <div className="rounded-xl border border-warning/40 bg-warning/10 text-warning-foreground p-3 text-xs flex items-start gap-2">
        <AlertTriangle className="size-4 mt-0.5 shrink-0" />
        Educational use only. AI outputs may be inaccurate. Consult a licensed clinician for any medical decision.
      </div>

      <section className="grid lg:grid-cols-3 gap-4">
        <ConfidenceCard score={confidence} agreement={comparison.agreement_level} />
        <RiskCard risk={risk} />
        <SpecialistCard
          finalCondition={comparison.final_condition}
          recommendation={comparison.final_recommendation}
        />
      </section>

      <ComparisonPanel gemini={gemini} gpt={gpt} disagreement={comparison.disagreement_notes} />

      <ConditionsSection gemini={gemini} gpt={gpt} />

      <LabValuesTable extracted={gemini.extracted_data ?? {}} abnormal={gemini.abnormal_findings ?? []} />

      <MedicationsSection gemini={gemini} gpt={gpt} />

      <RecommendationsSection gemini={gemini} gpt={gpt} />
    </div>
  );
}

function ConfidenceCard({ score, agreement }: { score: number; agreement: string }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(score, 100) / 100) * c;
  const colorVar = score >= 75 ? "var(--success)" : score >= 50 ? "var(--primary)" : "var(--warning)";
  return (
    <div className="glass-card rounded-2xl p-5 flex items-center gap-5">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--muted)" strokeWidth="10" />
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke={colorVar}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 800ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-display font-semibold tabular-nums">{Math.round(score)}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">AI agreement</div>
        <div className="font-display text-xl font-semibold">{agreement || "—"}</div>
        <p className="text-xs text-muted-foreground max-w-[16ch]">
          Combined score of condition, risk and findings overlap.
        </p>
      </div>
    </div>
  );
}

function RiskCard({ risk }: { risk: "low" | "medium" | "high" }) {
  const styles = {
    low: { label: "Low risk", bg: "bg-success/15", text: "text-success", ring: "ring-success/30" },
    medium: { label: "Medium risk", bg: "bg-warning/20", text: "text-warning", ring: "ring-warning/40" },
    high: { label: "High risk", bg: "bg-destructive/15", text: "text-destructive", ring: "ring-destructive/30" },
  }[risk];
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Risk level</div>
      <div
        className={`self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${styles.bg} ${styles.text} ring-1 ${styles.ring} text-sm font-medium`}
      >
        <HeartPulse className="size-4" />
        {styles.label}
      </div>
      <p className="text-xs text-muted-foreground">
        Based on combined abnormal findings across both models.
      </p>
    </div>
  );
}

function SpecialistCard({ finalCondition, recommendation }: { finalCondition: string; recommendation: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Stethoscope className="size-3.5" /> Top agreed finding
      </div>
      <div className="font-display text-lg font-semibold leading-tight">{finalCondition || "—"}</div>
      <p className="text-xs text-muted-foreground line-clamp-3">{recommendation}</p>
    </div>
  );
}

function ComparisonPanel({
  gemini,
  gpt,
  disagreement,
}: {
  gemini: AIAnalysisResult;
  gpt: AIAnalysisResult;
  disagreement: string;
}) {
  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-medical" />
        <h2 className="font-display text-lg font-semibold">GPT vs Gemini comparison</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <ModelColumn name="Gemini" color="primary" data={gemini} />
        <ModelColumn name="GPT" color="medical" data={gpt} />
      </div>
      {disagreement && (
        <div className="rounded-xl bg-muted/60 p-4 text-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Disagreement notes
          </div>
          {disagreement}
        </div>
      )}
    </section>
  );
}

function ModelColumn({
  name,
  color,
  data,
}: {
  name: string;
  color: "primary" | "medical";
  data: AIAnalysisResult;
}) {
  const top = data.possible_conditions?.[0];
  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={`size-2 rounded-full ${color === "primary" ? "bg-primary" : "bg-medical"}`} />
          {name}
        </div>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Conf {data.confidence_score || "—"}
        </span>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Top condition</div>
        <div className="font-medium">{top?.name || "—"}</div>
        <div className="text-xs text-muted-foreground">Probability: {top?.probability || "—"}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Risk</div>
        <div className="font-medium">{data.risk_level || "—"}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">Suggested specialist</div>
        <div className="font-medium">{data.doctor_recommendation || "General Physician"}</div>
      </div>
    </div>
  );
}

function ConditionsSection({ gemini, gpt }: { gemini: AIAnalysisResult; gpt: AIAnalysisResult }) {
  const merged = useMemo(() => {
    const all = [
      ...(gemini.possible_conditions ?? []).map((c) => ({ ...c, src: "Gemini" })),
      ...(gpt.possible_conditions ?? []).map((c) => ({ ...c, src: "GPT" })),
    ];
    return all.slice(0, 6);
  }, [gemini, gpt]);

  if (merged.length === 0) return null;

  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 space-y-4">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <Activity className="size-4 text-primary" /> Possible conditions
      </h2>
      <div className="grid md:grid-cols-2 gap-3">
        {merged.map((c, i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium">{c.name}</div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c.src}</span>
            </div>
            <div className="text-xs text-primary font-medium">Probability: {c.probability}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">{c.reasoning}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LabValuesTable({
  extracted,
  abnormal,
}: {
  extracted: Record<string, unknown>;
  abnormal: string[];
}) {
  const entries = Object.entries(extracted).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0 && abnormal.length === 0) return null;

  const isAbnormal = (key: string) =>
    abnormal.some((a) => a.toLowerCase().includes(key.toLowerCase()));

  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 space-y-4">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <FlaskConical className="size-4 text-medical" /> Extracted lab values
      </h2>
      {entries.length > 0 ? (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-medium">Parameter</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([k, v]) => {
                const flag = isAbnormal(k);
                return (
                  <tr key={k} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium capitalize">{k.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 font-mono">{String(v as string)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full ${
                          flag ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
                        }`}
                      >
                        {flag ? "Abnormal" : "Normal"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {abnormal.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Abnormal findings</div>
          <ul className="text-sm space-y-1 list-disc pl-5">
            {abnormal.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function MedicationsSection({ gemini, gpt }: { gemini: AIAnalysisResult; gpt: AIAnalysisResult }) {
  const meds = Array.from(
    new Set([...(gemini.medications_suggestion ?? []), ...(gpt.medications_suggestion ?? [])]),
  );
  if (meds.length === 0) return null;
  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 space-y-3">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <Pill className="size-4 text-primary" /> Medication suggestions (generic, educational)
      </h2>
      <div className="flex flex-wrap gap-2">
        {meds.map((m, i) => (
          <span key={i} className="text-xs px-3 py-1.5 rounded-full bg-medical/15 text-medical-foreground border border-medical/30">
            {m}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Generic class names only — not a prescription. A licensed clinician must determine actual treatment.
      </p>
    </section>
  );
}

function RecommendationsSection({ gemini, gpt }: { gemini: AIAnalysisResult; gpt: AIAnalysisResult }) {
  const tests = Array.from(new Set([...(gemini.recommended_tests ?? []), ...(gpt.recommended_tests ?? [])]));
  const lifestyle = Array.from(
    new Set([...(gemini.lifestyle_advice ?? []), ...(gpt.lifestyle_advice ?? [])]),
  );
  const warnings = Array.from(new Set([...(gemini.warnings ?? []), ...(gpt.warnings ?? [])]));

  return (
    <section className="grid md:grid-cols-2 gap-4">
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <h3 className="font-display font-semibold">Recommended next tests</h3>
        {tests.length ? (
          <ul className="text-sm space-y-1.5 list-disc pl-5">
            {tests.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">None suggested.</p>
        )}
      </div>
      <div className="glass-card rounded-2xl p-5 space-y-3">
        <h3 className="font-display font-semibold">Lifestyle advice</h3>
        {lifestyle.length ? (
          <ul className="text-sm space-y-1.5 list-disc pl-5">
            {lifestyle.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">None suggested.</p>
        )}
      </div>
      {warnings.length > 0 && (
        <div className="md:col-span-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 space-y-2">
          <h3 className="font-display font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4" /> Warnings
          </h3>
          <ul className="text-sm space-y-1 list-disc pl-5 text-destructive">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
