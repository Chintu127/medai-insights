export interface PatientProfile {
  name: string;
  age: string;
  gender: string;
  weight: string;
  history: string;
  lifestyle: string;
}

export interface PossibleCondition {
  name: string;
  probability: string;
  reasoning: string;
}

export interface ExplainableFinding {
  finding: string; // e.g. "Hemoglobin 9.8 g/dL (Low)"
  implies: string; // e.g. "Anemia"
  why: string; // 1-line clinical reasoning
}

export interface LabValue {
  name: string;
  value: string;
  unit?: string;
  reference_range?: string;
  status?: "Normal" | "Low" | "High" | "Critical" | string;
  interpretation?: string;
}

export interface AIAnalysisResult {
  extracted_data: Record<string, unknown>;
  parsed_labs?: LabValue[];
  abnormal_findings: string[];
  possible_conditions: PossibleCondition[];
  secondary_conditions?: string[];
  explainable_findings?: ExplainableFinding[];
  risk_level: "Low" | "Medium" | "High" | string;
  confidence_score: string;
  health_score?: string; // 0-100
  recommended_tests: string[];
  medications_suggestion: string[];
  lifestyle_advice: string[];
  warnings: string[];
  doctor_recommendation?: string;
  simplified_summary?: string; // plain-language explanation
  dataset_match?: string; // e.g. "78%"
  research_notes?: string;
}

export interface ComparisonResult {
  final_condition: string;
  agreement_level: string;
  confidence_score: string;
  disagreement_notes: string;
  final_recommendation: string;
}

export interface DualAIResponse {
  gemini: AIAnalysisResult;
  gpt: AIAnalysisResult;
  comparison: ComparisonResult;
}

export interface LabAttachment {
  base64: string;
  mimeType: string;
  name: string;
}

export interface AnalysisRequest {
  patient: PatientProfile;
  symptoms: string;
  labReportText?: string;
  // Legacy single-image fields kept for backwards compat
  labReportImageBase64?: string;
  labReportMimeType?: string;
  // New multi-file support
  labAttachments?: LabAttachment[];
}

export interface MedicineInfo {
  name: string;
  generic_name: string;
  drug_class: string;
  used_for: string[];
  diseases: string[];
  dosage_form: string;
  mechanism: string;
  common_side_effects: string[];
  contraindications: string[];
  safety_note: string;
  image_query: string;
}

export interface ScannedMedicine extends MedicineInfo {
  identification_confidence?: string; // 0-100, only for image scans
  visual_notes?: string; // e.g. "white round tablet, '500' imprint"
}

export interface DrugInteraction {
  drugs: string[]; // 2+ medicines involved
  severity: "Minor" | "Moderate" | "Major" | string;
  effect: string;
  recommendation: string;
}
