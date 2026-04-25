// Compute a structured per-parameter clinical interpretation from parsed labs.
// Produces the exact shape requested by the user spec (status / risk / severity).

import type { LabValue } from "./medical-types";
import { lookupReferenceRange, inferStatus } from "./lab-reference-ranges";

export type ParamStatus = "NORMAL" | "LOW" | "HIGH" | "CRITICAL";
export type Severity = "Mild" | "Moderate" | "Severe" | "None";

export interface ClinicalParam {
  name: string;
  value: number | string;
  unit?: string;
  reference_range?: string;
  status: ParamStatus;
  risk: string;
  severity: Severity;
  deviation_pct: number; // % away from nearest range edge
}

export interface ClinicalAnalysis {
  analysis: ClinicalParam[];
  summary: {
    issues: string[];
    normal_parameters: string[];
    severity_score: number; // 0-100
    overall_status: "Healthy" | "Mild Concerns" | "Needs Medical Attention" | "Urgent — See Doctor";
  };
  recommendation: string;
}

// Simple knowledge base of clinical implications by direction.
const RISK_MAP: Record<string, { high?: string; low?: string }> = {
  hemoglobin: { low: "Possible Anemia", high: "Possible Polycythemia" },
  hgb: { low: "Possible Anemia", high: "Possible Polycythemia" },
  wbc: { high: "Possible Infection / Inflammation", low: "Possible Immunosuppression" },
  rbc: { low: "Possible Anemia", high: "Possible Polycythemia" },
  platelets: { low: "Bleeding risk (Thrombocytopenia)", high: "Clotting risk (Thrombocytosis)" },
  glucose: { high: "Possible Hyperglycemia / Diabetes risk", low: "Hypoglycemia" },
  "fasting glucose": { high: "Possible Diabetes / Pre-diabetes", low: "Hypoglycemia" },
  hba1c: { high: "Poor glycemic control / Diabetes risk" },
  cholesterol: { high: "Cardiovascular risk (Hypercholesterolemia)" },
  "total cholesterol": { high: "Cardiovascular risk" },
  ldl: { high: "Atherosclerosis / Cardiac risk" },
  hdl: { low: "Reduced cardio-protection" },
  triglycerides: { high: "Metabolic syndrome risk" },
  creatinine: { high: "Possible Kidney Dysfunction", low: "Low muscle mass / dilution" },
  urea: { high: "Possible Kidney Dysfunction / Dehydration" },
  bun: { high: "Possible Kidney Dysfunction / Dehydration" },
  sodium: { high: "Hypernatremia (dehydration)", low: "Hyponatremia" },
  potassium: { high: "Hyperkalemia (cardiac risk)", low: "Hypokalemia (muscle/cardiac risk)" },
  tsh: { high: "Possible Hypothyroidism", low: "Possible Hyperthyroidism" },
  alt: { high: "Possible Liver Stress / Hepatitis" },
  ast: { high: "Possible Liver Stress" },
  bilirubin: { high: "Possible Liver / Biliary issue" },
  "vitamin d": { low: "Vitamin D Deficiency" },
  vitamin_d: { low: "Vitamin D Deficiency" },
  b12: { low: "B12 Deficiency (neuro/anemia risk)" },
  crp: { high: "Active Inflammation" },
};

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}

function riskFor(name: string, status: ParamStatus): string {
  const key = normalizeKey(name);
  const direct = RISK_MAP[key];
  let match = direct;
  if (!match) {
    for (const k of Object.keys(RISK_MAP)) {
      if (key.includes(k) || k.includes(key)) {
        match = RISK_MAP[k];
        break;
      }
    }
  }
  if (!match) return status === "NORMAL" ? "Within normal limits" : `${status[0]}${status.slice(1).toLowerCase()} value — clinical correlation needed`;
  if (status === "HIGH" || status === "CRITICAL") return match.high ?? "Elevated — clinical correlation needed";
  if (status === "LOW") return match.low ?? "Reduced — clinical correlation needed";
  return "Within normal limits";
}

function parseNumeric(v: string | number | undefined): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function severityFromDeviation(pct: number, status: ParamStatus): Severity {
  if (status === "NORMAL") return "None";
  const p = Math.abs(pct);
  if (p < 15) return "Mild";
  if (p < 40) return "Moderate";
  return "Severe";
}

function statusToParam(s: string | undefined): ParamStatus {
  const v = (s ?? "").toUpperCase();
  if (v.includes("CRIT")) return "CRITICAL";
  if (v.includes("HIGH")) return "HIGH";
  if (v.includes("LOW")) return "LOW";
  return "NORMAL";
}

export function buildClinicalAnalysis(labs: LabValue[]): ClinicalAnalysis {
  const params: ClinicalParam[] = [];

  for (const lab of labs) {
    const num = parseNumeric(lab.value);
    const ref = lookupReferenceRange(lab.name);

    // Determine status
    let status: ParamStatus = statusToParam(lab.status);
    if (status === "NORMAL" && num !== null) {
      const inferred = inferStatus(lab.name, num);
      if (inferred) status = statusToParam(inferred);
    }

    // Compute deviation %
    let deviation = 0;
    if (num !== null && ref) {
      if (ref.low !== undefined && num < ref.low) {
        deviation = ((num - ref.low) / ref.low) * 100;
      } else if (ref.high !== undefined && num > ref.high) {
        deviation = ((num - ref.high) / ref.high) * 100;
      }
    }

    const severity = severityFromDeviation(deviation, status);
    const risk = riskFor(lab.name, status);

    params.push({
      name: lab.name,
      value: num ?? lab.value,
      unit: lab.unit ?? ref?.unit,
      reference_range: lab.reference_range ?? ref?.range,
      status,
      risk,
      severity,
      deviation_pct: Math.round(deviation * 10) / 10,
    });
  }

  const abnormal = params.filter((p) => p.status !== "NORMAL");
  const issues = Array.from(
    new Set(abnormal.map((p) => p.risk).filter((r) => r && !/within normal/i.test(r))),
  );
  const normal_parameters = params.filter((p) => p.status === "NORMAL").map((p) => p.name);

  // Severity score: weighted by severity tier
  let score = 0;
  for (const p of abnormal) {
    if (p.severity === "Severe") score += 35;
    else if (p.severity === "Moderate") score += 20;
    else if (p.severity === "Mild") score += 8;
    if (p.status === "CRITICAL") score += 15;
  }
  score = Math.min(100, score);

  let overall_status: ClinicalAnalysis["summary"]["overall_status"] = "Healthy";
  if (score >= 70) overall_status = "Urgent — See Doctor";
  else if (score >= 40) overall_status = "Needs Medical Attention";
  else if (score > 0) overall_status = "Mild Concerns";

  const recommendation =
    overall_status === "Healthy"
      ? "All measured parameters fall within standard reference ranges. Maintain healthy lifestyle and routine check-ups."
      : overall_status === "Urgent — See Doctor"
        ? "Several parameters show significant deviation. Consult a healthcare professional promptly for evaluation."
        : "Consult a healthcare professional for further evaluation and confirmatory testing.";

  return {
    analysis: params,
    summary: { issues, normal_parameters, severity_score: score, overall_status },
    recommendation,
  };
}
