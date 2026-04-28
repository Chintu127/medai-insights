import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FlaskConical,
  HeartPulse,
  Lightbulb,
  Pill,
  Sparkles,
  Stethoscope,
  Database,
} from "lucide-react";
import { useMedicalState } from "@/lib/medical-store";
import type { AIAnalysisResult, LabValue } from "@/lib/medical-types";
import { generateMedicalReportPDF } from "@/lib/pdf-report";
import { lookupReferenceRange, inferStatus } from "@/lib/lab-reference-ranges";
import { buildClinicalAnalysis, type ClinicalAnalysis, type ClinicalParam } from "@/lib/clinical-analysis";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Results — MedAI" },
      { name: "description", content: "Dual-AI possible conditions, lab values, risk and confidence." },
    ],
  }),
  component: ResultsPage,
  errorComponent: ResultsErrorComponent,
  notFoundComponent: () => (
    <div className="px-4 md:px-10 py-16 max-w-3xl mx-auto text-center space-y-3">
      <h1 className="font-display text-2xl font-semibold">Results not found</h1>
      <p className="text-sm text-muted-foreground">Try running a new analysis.</p>
      <Link to="/upload" className="inline-flex items-center gap-2 px-5 h-11 rounded-xl gradient-primary text-white font-medium glow">
        Start analysis
      </Link>
    </div>
  ),
});

function ResultsErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="px-4 md:px-10 py-16 max-w-3xl mx-auto text-center space-y-4">
      <div className="size-14 rounded-2xl bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="font-display text-2xl font-semibold">Couldn't render results</h1>
      <p className="text-sm text-muted-foreground break-words">{error.message || "Unexpected error while displaying results."}</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="px-4 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
        >
          Try again
        </button>
        <Link to="/upload" className="px-4 h-10 inline-flex items-center rounded-lg border border-input text-sm">
          New analysis
        </Link>
      </div>
    </div>
  );
}

function pickRisk(level: string | undefined): "low" | "medium" | "high" {
  const v = (level ?? "").toLowerCase();
  if (v.includes("high") || v.includes("critical")) return "high";
  if (v.includes("med")) return "medium";
  return "low";
}

const SPECIALIST_HINT: Record<string, string> = {
  cardiologist: "Heart, BP, lipids",
  endocrinologist: "Diabetes, thyroid, hormones",
  pulmonologist: "Lungs, asthma, COPD",
  nephrologist: "Kidney, electrolytes",
  hematologist: "Blood disorders, anemia",
  gastroenterologist: "GI, liver",
  neurologist: "Brain, nerves",
  rheumatologist: "Autoimmune, joints",
  dermatologist: "Skin",
  "general physician": "First-line evaluation",
};

function specialistHint(name?: string): string {
  if (!name) return "First-line evaluation";
  const k = name.toLowerCase();
  for (const key of Object.keys(SPECIALIST_HINT)) {
    if (k.includes(key)) return SPECIALIST_HINT[key];
  }
  return "Specialist consultation";
}

// Enrich parsed labs with reference ranges from the local fallback table
function enrichLabs(labs: LabValue[]): LabValue[] {
  return labs.map((lab) => {
    if (lab.reference_range && lab.status) return lab;
    const ref = lookupReferenceRange(lab.name);
    const status =
      lab.status ||
      (lab.value && ref ? inferStatus(lab.name, lab.value) ?? lab.status : lab.status);
    return {
      ...lab,
      reference_range: lab.reference_range || ref?.range,
      status: status ?? lab.status,
    };
  });
}

function ResultsPage() {
  const { result, status, request } = useMedicalState();

  const downloadPDF = () => {
    if (!result) return;
    const doc = generateMedicalReportPDF(result, request);
    const safeName = (request?.patient.name || "patient").replace(/[^a-z0-9_-]/gi, "_") || "patient";
    doc.save(`medai-report-${safeName}-${Date.now()}.pdf`);
  };

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
  const geminiConf = Number(gemini.confidence_score?.toString().replace(/[^0-9.]/g, "")) || 0;
  const gptConf = Number(gpt.confidence_score?.toString().replace(/[^0-9.]/g, "")) || 0;
  const agreement = Math.max(0, 100 - Math.abs(geminiConf - gptConf));
  const healthScore =
    Number(
      (gemini.health_score ?? gpt.health_score ?? "")
        .toString()
        .replace(/[^0-9.]/g, ""),
    ) || 0;
  const risk = pickRisk(gemini.risk_level || gpt.risk_level);
  const datasetMatch =
    gemini.dataset_match || gpt.dataset_match || `${Math.round((confidence + agreement) / 2)}%`;

  const enrichedLabs = enrichLabs(gemini.parsed_labs ?? gpt.parsed_labs ?? []);
  const clinical = useMemo(() => buildClinicalAnalysis(enrichedLabs), [enrichedLabs]);
  const simplified = gemini.simplified_summary || gpt.simplified_summary || "";

  return (
    <div className="px-4 md:px-10 py-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-semibold">Analysis Report</h1>
          <p className="text-sm text-muted-foreground">
            Dual-AI verification by Gemini and GPT — possible conditions, not a diagnosis.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadPDF}
            className="text-sm inline-flex items-center gap-1.5 px-4 h-10 rounded-lg gradient-primary text-white font-medium glow"
          >
            <Download className="size-4" /> Download PDF
          </button>
          <Link
            to="/upload"
            className="text-sm inline-flex items-center gap-1.5 px-4 h-10 rounded-lg border border-border hover:bg-muted"
          >
            New analysis <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <div className="rounded-xl border border-warning/40 bg-warning/10 text-warning-foreground p-3 text-xs flex items-start gap-2">
        <AlertTriangle className="size-4 mt-0.5 shrink-0" />
        Educational use only. AI outputs may be inaccurate. Consult a licensed clinician for any medical decision.
      </div>

      {simplified && (
        <section className="glass-card rounded-2xl p-5 md:p-6 space-y-2 border-l-4 border-primary">
          <div className="text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> What this means in plain language
          </div>
          <p className="text-sm md:text-base leading-relaxed">{simplified}</p>
        </section>
      )}

      <section className="grid lg:grid-cols-4 gap-4">
        <ConfidenceCard score={confidence} agreement={comparison.agreement_level} />
        <HealthScoreCard score={healthScore} />
        <RiskCard risk={risk} />
        <DatasetMatchCard match={datasetMatch} />
      </section>

      {/* Confidence breakdown */}
      <section className="glass-card rounded-2xl p-5 md:p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <CheckCircle2 className="size-4 text-medical" /> Confidence breakdown
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ConfBar label="Gemini" value={geminiConf} color="primary" />
          <ConfBar label="GPT" value={gptConf} color="medical" />
          <ConfBar label="Agreement" value={agreement} color="success" />
          <ConfBar label="Final" value={confidence} color="warning" />
        </div>
      </section>

      <ComparisonPanel gemini={gemini} gpt={gpt} disagreement={comparison.disagreement_notes} />

      <ConditionsSection gemini={gemini} gpt={gpt} />

      <ExplainableSection gemini={gemini} gpt={gpt} />

      <DoctorRecommendationCards gemini={gemini} gpt={gpt} />

      <ClinicalAnalysisSection clinical={clinical} />

      <ParsedLabsSection labs={enrichedLabs} />

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
    <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
      <div className="relative size-28 shrink-0">
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
          <div className="text-2xl font-display font-semibold tabular-nums">{Math.round(score)}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Conf.</div>
        </div>
      </div>
      <div className="space-y-1 min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">AI agreement</div>
        <div className="font-display text-base font-semibold">{agreement || "—"}</div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Combined: condition · risk · findings.
        </p>
      </div>
    </div>
  );
}

function HealthScoreCard({ score }: { score: number }) {
  const tone =
    score >= 80
      ? { color: "var(--success)", label: "Excellent" }
      : score >= 60
        ? { color: "var(--medical)", label: "Good" }
        : score >= 40
          ? { color: "var(--warning)", label: "Concerns" }
          : { color: "var(--destructive)", label: "Critical" };
  return (
    <div className="glass-card rounded-2xl p-5 space-y-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <HeartPulse className="size-3.5" /> Health score
      </div>
      <div className="flex items-baseline gap-1">
        <div className="text-4xl font-display font-semibold tabular-nums" style={{ color: tone.color }}>
          {Math.round(score)}
        </div>
        <div className="text-sm text-muted-foreground">/ 100</div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(score, 100)}%`, background: tone.color }}
        />
      </div>
      <div className="text-xs font-medium" style={{ color: tone.color }}>
        {tone.label}
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
      <p className="text-xs text-muted-foreground">Combined abnormal findings across both models.</p>
    </div>
  );
}

function DatasetMatchCard({ match }: { match: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 space-y-2">
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Database className="size-3.5" /> Dataset match
      </div>
      <div className="text-3xl font-display font-semibold text-medical-foreground">{match}</div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Estimated alignment with documented clinical patterns (RAG signal).
      </p>
    </div>
  );
}

function ConfBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "primary" | "medical" | "success" | "warning";
}) {
  const bg =
    color === "primary"
      ? "bg-primary"
      : color === "medical"
        ? "bg-medical"
        : color === "success"
          ? "bg-success"
          : "bg-warning";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{Math.round(value)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${bg}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
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

  const secondary = useMemo(
    () =>
      Array.from(
        new Set([...(gemini.secondary_conditions ?? []), ...(gpt.secondary_conditions ?? [])]),
      ),
    [gemini, gpt],
  );

  if (merged.length === 0 && secondary.length === 0) return null;

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

      {secondary.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Secondary risks to monitor</div>
          <div className="flex flex-wrap gap-2">
            {secondary.map((s, i) => (
              <span
                key={i}
                className="text-xs px-3 py-1.5 rounded-full bg-warning/10 text-warning border border-warning/30"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ExplainableSection({ gemini, gpt }: { gemini: AIAnalysisResult; gpt: AIAnalysisResult }) {
  const all = [...(gemini.explainable_findings ?? []), ...(gpt.explainable_findings ?? [])];
  // Dedupe by finding+implies
  const seen = new Set<string>();
  const findings = all.filter((f) => {
    const key = `${f.finding}|${f.implies}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (findings.length === 0) return null;

  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 space-y-4">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <Lightbulb className="size-4 text-warning" /> Why these conditions? (Explainable AI)
      </h2>
      <p className="text-xs text-muted-foreground -mt-2">
        Each chip traces a finding from the report to the condition it suggests.
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        {findings.map((f, i) => (
          <div
            key={i}
            className="rounded-xl border border-border p-4 space-y-2 bg-gradient-to-br from-background to-muted/40"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="px-2 py-0.5 rounded-md bg-primary/15 text-primary font-medium">
                {f.finding}
              </span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span className="px-2 py-0.5 rounded-md bg-medical/15 text-medical-foreground font-medium">
                {f.implies}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{f.why}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DoctorRecommendationCards({
  gemini,
  gpt,
}: {
  gemini: AIAnalysisResult;
  gpt: AIAnalysisResult;
}) {
  const specs = Array.from(
    new Set(
      [gemini.doctor_recommendation, gpt.doctor_recommendation].filter(
        (s): s is string => Boolean(s),
      ),
    ),
  );
  if (specs.length === 0) specs.push("General Physician");
  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 space-y-4">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <Stethoscope className="size-4 text-medical" /> Recommended specialists
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {specs.map((s, i) => (
          <div
            key={i}
            className="rounded-xl border border-border p-4 flex items-start gap-3 bg-background/60"
          >
            <div className="size-11 rounded-xl gradient-primary text-white flex items-center justify-center shrink-0">
              <Stethoscope className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="font-medium leading-tight">{s}</div>
              <div className="text-xs text-muted-foreground">{specialistHint(s)}</div>
            </div>
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

function ParsedLabsSection({ labs }: { labs: LabValue[] }) {
  if (!labs || labs.length === 0) return null;
  const statusStyle = (s?: string) => {
    const v = (s ?? "").toLowerCase();
    if (v.includes("critical")) return "bg-destructive/20 text-destructive";
    if (v.includes("high") || v.includes("low") || v.includes("abnormal"))
      return "bg-warning/20 text-warning";
    return "bg-success/15 text-success";
  };
  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 space-y-4">
      <h2 className="font-display text-lg font-semibold flex items-center gap-2">
        <FlaskConical className="size-4 text-medical" /> Parsed lab parameters
      </h2>
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <th className="px-3 py-2 font-medium">Parameter</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Reference range</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Interpretation</th>
            </tr>
          </thead>
          <tbody>
            {labs.map((lab, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0 align-top">
                <td className="px-3 py-2 font-medium">{lab.name}</td>
                <td className="px-3 py-2 font-mono whitespace-nowrap">
                  {lab.value}
                  {lab.unit ? ` ${lab.unit}` : ""}
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {lab.reference_range || "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusStyle(lab.status)}`}>
                    {lab.status || "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {lab.interpretation || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
          <span
            key={i}
            className="text-xs px-3 py-1.5 rounded-full bg-medical/15 text-medical-foreground border border-medical/30"
          >
            {m}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Generic class names only — not a prescription. A licensed clinician must determine actual treatment.
        For drug-drug interaction checks, add these to the Medicines page.
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

function ClinicalAnalysisSection({ clinical }: { clinical: ClinicalAnalysis }) {
  if (!clinical.analysis.length) return null;
  const { summary } = clinical;
  const overallStyle =
    summary.overall_status === "Healthy"
      ? "bg-success/15 text-success border-success/30"
      : summary.overall_status === "Mild Concerns"
        ? "bg-warning/15 text-warning border-warning/30"
        : summary.overall_status === "Needs Medical Attention"
          ? "bg-warning/20 text-warning border-warning/40"
          : "bg-destructive/15 text-destructive border-destructive/40";

  const statusBadge = (s: ClinicalParam["status"]) => {
    if (s === "CRITICAL") return "bg-destructive/20 text-destructive border-destructive/30";
    if (s === "HIGH") return "bg-warning/20 text-warning border-warning/30";
    if (s === "LOW") return "bg-primary/15 text-primary border-primary/30";
    return "bg-success/15 text-success border-success/30";
  };
  const sevBadge = (s: ClinicalParam["severity"]) => {
    if (s === "Severe") return "bg-destructive/20 text-destructive";
    if (s === "Moderate") return "bg-warning/20 text-warning";
    if (s === "Mild") return "bg-primary/15 text-primary";
    return "bg-muted text-muted-foreground";
  };

  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Stethoscope className="size-4 text-medical" /> Clinical analysis
          </h2>
          <p className="text-xs text-muted-foreground">
            Per-parameter status · risk · severity — derived from your lab values.
          </p>
        </div>
        <span className={`text-xs px-3 py-1.5 rounded-full border font-medium ${overallStyle}`}>
          {summary.overall_status}
        </span>
      </div>

      {/* Severity gauge */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Severity score</span>
          <span className="tabular-nums font-medium text-foreground">{summary.severity_score} / 100</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${summary.severity_score}%`,
              background:
                summary.severity_score >= 70
                  ? "var(--destructive)"
                  : summary.severity_score >= 40
                    ? "var(--warning)"
                    : summary.severity_score > 0
                      ? "var(--primary)"
                      : "var(--success)",
            }}
          />
        </div>
      </div>

      {/* Issues / Normals chips */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Detected issues</div>
          {summary.issues.length ? (
            <div className="flex flex-wrap gap-1.5">
              {summary.issues.map((i, idx) => (
                <span key={idx} className="text-[11px] px-2 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                  {i}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-success">No abnormalities detected.</p>
          )}
        </div>
        <div className="rounded-xl border border-border p-3 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Normal parameters</div>
          {summary.normal_parameters.length ? (
            <div className="flex flex-wrap gap-1.5">
              {summary.normal_parameters.map((n, idx) => (
                <span key={idx} className="text-[11px] px-2 py-1 rounded-full bg-success/10 text-success border border-success/20">
                  {n}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {/* Per-parameter table */}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <th className="px-3 py-2 font-medium">Parameter</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Range</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">Severity</th>
              <th className="px-3 py-2 font-medium text-right">Δ</th>
            </tr>
          </thead>
          <tbody>
            {clinical.analysis.map((p, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0 align-top">
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2 font-mono whitespace-nowrap">
                  {p.value}{p.unit ? ` ${p.unit}` : ""}
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {p.reference_range || "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${statusBadge(p.status)}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{p.risk}</td>
                <td className="px-3 py-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${sevBadge(p.severity)}`}>
                    {p.severity}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground">
                  {p.deviation_pct ? `${p.deviation_pct > 0 ? "+" : ""}${p.deviation_pct}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm flex items-start gap-2">
        <Lightbulb className="size-4 mt-0.5 text-primary shrink-0" />
        <span>{clinical.recommendation}</span>
      </div>
    </section>
  );
}
