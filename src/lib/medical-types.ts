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

export interface AIAnalysisResult {
  extracted_data: Record<string, unknown>;
  abnormal_findings: string[];
  possible_conditions: PossibleCondition[];
  risk_level: "Low" | "Medium" | "High" | string;
  confidence_score: string;
  recommended_tests: string[];
  medications_suggestion: string[];
  lifestyle_advice: string[];
  warnings: string[];
  doctor_recommendation?: string;
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

export interface AnalysisRequest {
  patient: PatientProfile;
  symptoms: string;
  labReportText?: string;
  labReportImageBase64?: string;
  labReportMimeType?: string;
}
