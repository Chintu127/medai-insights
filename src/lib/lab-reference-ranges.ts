// Standard adult reference ranges used as fallback when the AI omits them.
// Keys are normalized lower-case parameter aliases.

export interface RefRange {
  label: string;
  range: string;
  unit?: string;
  low?: number;
  high?: number;
}

const RANGES: Record<string, RefRange> = {
  glucose: { label: "Glucose (Fasting)", range: "70 – 99 mg/dL", unit: "mg/dL", low: 70, high: 99 },
  "fasting glucose": { label: "Glucose (Fasting)", range: "70 – 99 mg/dL", unit: "mg/dL", low: 70, high: 99 },
  hba1c: { label: "HbA1c", range: "< 5.7 %", unit: "%", high: 5.7 },
  hemoglobin: { label: "Hemoglobin", range: "13.5 – 17.5 g/dL (M) · 12.0 – 15.5 (F)", unit: "g/dL", low: 12, high: 17.5 },
  hgb: { label: "Hemoglobin", range: "13.5 – 17.5 g/dL", unit: "g/dL", low: 12, high: 17.5 },
  wbc: { label: "WBC", range: "4.0 – 11.0 ×10⁹/L", unit: "10^9/L", low: 4, high: 11 },
  rbc: { label: "RBC", range: "4.5 – 5.9 ×10¹²/L", unit: "10^12/L", low: 4.5, high: 5.9 },
  platelets: { label: "Platelets", range: "150 – 450 ×10⁹/L", unit: "10^9/L", low: 150, high: 450 },
  cholesterol: { label: "Total Cholesterol", range: "< 200 mg/dL", unit: "mg/dL", high: 200 },
  "total cholesterol": { label: "Total Cholesterol", range: "< 200 mg/dL", unit: "mg/dL", high: 200 },
  ldl: { label: "LDL", range: "< 100 mg/dL", unit: "mg/dL", high: 100 },
  hdl: { label: "HDL", range: "> 40 mg/dL (M) · > 50 (F)", unit: "mg/dL", low: 40 },
  triglycerides: { label: "Triglycerides", range: "< 150 mg/dL", unit: "mg/dL", high: 150 },
  creatinine: { label: "Creatinine", range: "0.7 – 1.3 mg/dL", unit: "mg/dL", low: 0.7, high: 1.3 },
  urea: { label: "Urea", range: "7 – 20 mg/dL", unit: "mg/dL", low: 7, high: 20 },
  bun: { label: "BUN", range: "7 – 20 mg/dL", unit: "mg/dL", low: 7, high: 20 },
  sodium: { label: "Sodium", range: "135 – 145 mmol/L", unit: "mmol/L", low: 135, high: 145 },
  potassium: { label: "Potassium", range: "3.5 – 5.0 mmol/L", unit: "mmol/L", low: 3.5, high: 5.0 },
  tsh: { label: "TSH", range: "0.4 – 4.0 mIU/L", unit: "mIU/L", low: 0.4, high: 4.0 },
  alt: { label: "ALT", range: "7 – 56 U/L", unit: "U/L", low: 7, high: 56 },
  ast: { label: "AST", range: "10 – 40 U/L", unit: "U/L", low: 10, high: 40 },
  bilirubin: { label: "Total Bilirubin", range: "0.1 – 1.2 mg/dL", unit: "mg/dL", low: 0.1, high: 1.2 },
  vitamin_d: { label: "Vitamin D (25-OH)", range: "30 – 100 ng/mL", unit: "ng/mL", low: 30, high: 100 },
  "vitamin d": { label: "Vitamin D (25-OH)", range: "30 – 100 ng/mL", unit: "ng/mL", low: 30, high: 100 },
  b12: { label: "Vitamin B12", range: "200 – 900 pg/mL", unit: "pg/mL", low: 200, high: 900 },
  crp: { label: "CRP", range: "< 10 mg/L", unit: "mg/L", high: 10 },
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function lookupReferenceRange(name: string): RefRange | null {
  if (!name) return null;
  const n = normalize(name);
  if (RANGES[n]) return RANGES[n];
  // Try keyword match
  for (const key of Object.keys(RANGES)) {
    if (n.includes(key) || key.includes(n)) return RANGES[key];
  }
  return null;
}

export function inferStatus(name: string, value: string | number): "Normal" | "Low" | "High" | null {
  const ref = lookupReferenceRange(name);
  if (!ref) return null;
  const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  if (Number.isNaN(num)) return null;
  if (ref.low !== undefined && num < ref.low) return "Low";
  if (ref.high !== undefined && num > ref.high) return "High";
  return "Normal";
}
