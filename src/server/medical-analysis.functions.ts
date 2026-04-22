import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const LabAttachmentSchema = z.object({
  base64: z.string().max(8_000_000),
  mimeType: z.string().max(80),
  name: z.string().max(200).default("attachment"),
});

const RequestSchema = z.object({
  patient: z.object({
    name: z.string().max(120).default(""),
    age: z.string().max(20).default(""),
    gender: z.string().max(40).default(""),
    weight: z.string().max(40).default(""),
    history: z.string().max(2000).default(""),
    lifestyle: z.string().max(2000).default(""),
  }),
  symptoms: z.string().max(4000).default(""),
  labReportText: z.string().max(20000).optional(),
  labReportImageBase64: z.string().max(8_000_000).optional(),
  labReportMimeType: z.string().max(80).optional(),
  labAttachments: z.array(LabAttachmentSchema).max(6).optional(),
});

type AnalysisInput = z.infer<typeof RequestSchema>;

const SYSTEM_PROMPT = `You are an advanced AI Medical Analysis System used in a Dual-AI verification pipeline (MedAI).

STRICT RULES:
- Do NOT provide a final diagnosis. Provide "Possible Conditions" only.
- Always include reasoning and highlight uncertainty.
- Use medically accurate terminology and standard adult reference ranges.
- Never hallucinate missing data. If data is missing, write "Insufficient data".
- Provide generic medication suggestions ONLY (no prescription dosages).
- Output STRICTLY valid JSON matching the provided schema. No prose outside JSON.

Schema:
{
  "extracted_data": { "<param>": "<raw value with unit>" },
  "parsed_labs": [
    {
      "name": "Glucose (Fasting)",
      "value": "186",
      "unit": "mg/dL",
      "reference_range": "70-99 mg/dL",
      "status": "Normal | Low | High | Critical",
      "interpretation": "Suggestive of hyperglycemia / possible diabetes"
    }
  ],
  "abnormal_findings": [ "Concise human-readable abnormal findings" ],
  "explainable_findings": [
    { "finding": "Hemoglobin 9.8 g/dL (Low)", "implies": "Anemia", "why": "Below normal cutoff of 12 g/dL — reduced oxygen-carrying capacity." }
  ],
  "possible_conditions": [ { "name":"", "probability":"e.g. 72%", "reasoning":"" } ],
  "secondary_conditions": [ "Other conditions worth considering" ],
  "risk_level": "Low | Medium | High",
  "confidence_score": "0-100",
  "health_score": "0-100 (overall current health, NOT confidence)",
  "recommended_tests": [ "..." ],
  "medications_suggestion": [ "generic name - purpose" ],
  "lifestyle_advice": [ "..." ],
  "warnings": [ "..." ],
  "doctor_recommendation": "e.g. Endocrinologist",
  "simplified_summary": "Plain-language 2-3 sentence summary a non-medical person can understand.",
  "dataset_match": "e.g. 78% (estimated alignment with documented clinical patterns)",
  "research_notes": "1-line note on supporting clinical literature pattern (no fake citations)."
}

PARSING REQUIREMENTS for parsed_labs:
- Extract every numerical lab parameter you can find from text or any provided images.
- Always include unit and standard adult reference_range when known.
- If a reference range is missing on the report, INFER the standard adult range from medical knowledge — do not leave it blank.
- Compare value vs range and assign status: Normal / Low / High / Critical.
- For each abnormal lab, briefly state clinical interpretation.
- If multiple report images are provided, merge findings across them.
- If no labs are found, return parsed_labs: [].

EXPLAINABLE FINDINGS:
- For each abnormal lab or symptom cluster that drives a possible condition, add an explainable_findings entry.
- Format: finding -> implies -> why (one short clinical sentence).

HEALTH SCORE:
- 90-100: excellent; 70-89: generally good; 50-69: concerns present; 30-49: significant issues; <30: severe.

Rank top 3 possible_conditions by probability. Use clinical reasoning (e.g. high glucose -> consider diabetes; low hemoglobin -> anemia; combine multi-parameter findings).`;

function buildUserContent(input: AnalysisInput) {
  const parts: Array<Record<string, unknown>> = [];
  const text = `Patient Profile:
- Name: ${input.patient.name || "N/A"}
- Age: ${input.patient.age || "N/A"}
- Gender: ${input.patient.gender || "N/A"}
- Weight: ${input.patient.weight || "N/A"}
- Medical History: ${input.patient.history || "None reported"}
- Lifestyle: ${input.patient.lifestyle || "Not specified"}

Symptoms:
${input.symptoms || "None reported"}

Lab Report (text, may be empty if image provided):
${input.labReportText || "(none)"}

Return ONLY the JSON object, no markdown fences. Be thorough with parsed_labs and ALWAYS infer reference ranges from medical knowledge when missing.`;
  parts.push({ type: "text", text });

  // Multi-attachment support (preferred)
  const attachments = input.labAttachments ?? [];
  for (const att of attachments) {
    if (att.mimeType.startsWith("image/")) {
      parts.push({
        type: "image_url",
        image_url: { url: `data:${att.mimeType};base64,${att.base64}` },
      });
    }
  }
  // Legacy single image
  if (
    attachments.length === 0 &&
    input.labReportImageBase64 &&
    input.labReportMimeType?.startsWith("image/")
  ) {
    parts.push({
      type: "image_url",
      image_url: {
        url: `data:${input.labReportMimeType};base64,${input.labReportImageBase64}`,
      },
    });
  }
  return parts;
}

async function callModel(model: string, input: AnalysisInput) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserContent(input) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Rate limit reached. Please wait a moment and try again.");
    if (res.status === 402)
      throw new Error("AI credits exhausted. Add credits in Lovable Workspace > Usage.");
    throw new Error(`AI gateway error (${res.status}) for ${model}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Model ${model} returned non-JSON output`);
  }
}

const COMPARISON_SYSTEM = `You are a Medical AI Comparison Engine. Given outputs from two medical AIs (Gemini and GPT), compare:
1. Detected conditions overlap
2. Risk level agreement
3. Findings similarity
Compute condition_match (0-100), risk_agreement (0-100), findings_similarity (0-100).
final confidence_score = average.
Return STRICTLY this JSON, nothing else:
{
  "final_condition": "best agreed condition or 'Insufficient agreement'",
  "agreement_level": "Strong | Moderate | Weak",
  "confidence_score": "0-100",
  "disagreement_notes": "...",
  "final_recommendation": "next clinical step in 1-2 sentences"
}`;

async function callComparison(gemini: unknown, gpt: unknown) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: COMPARISON_SYSTEM },
        {
          role: "user",
          content: `Gemini Output:\n${JSON.stringify(gemini)}\n\nGPT Output:\n${JSON.stringify(gpt)}\n\nReturn the JSON only.`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Comparison gateway error (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return {
      final_condition: "Unable to compare",
      agreement_level: "Weak",
      confidence_score: "0",
      disagreement_notes: "Comparison parse failure",
      final_recommendation: "Consult a physician.",
    };
  }
}

export const analyzeMedical = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => RequestSchema.parse(raw))
  .handler(async ({ data }) => {
    try {
      const [gemini, gpt] = await Promise.all([
        callModel("google/gemini-2.5-flash", data),
        callModel("openai/gpt-5-mini", data),
      ]);
      const comparison = await callComparison(gemini, gpt);
      return { gemini, gpt, comparison, error: null as string | null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("analyzeMedical failed:", message);
      return {
        gemini: null,
        gpt: null,
        comparison: null,
        error: message,
      };
    }
  });

// =====================================================
// Medicine lookup (text query)
// =====================================================

const MedicineRequestSchema = z.object({
  query: z.string().min(1).max(200),
});

const MEDICINE_SYSTEM = `You are a pharmaceutical AI assistant. For the medicine name provided, return STRICT JSON:
{
  "name": "<as provided>",
  "generic_name": "",
  "drug_class": "",
  "used_for": ["primary indications"],
  "diseases": ["specific diseases this medicine treats or is commonly used in"],
  "dosage_form": "tablet | capsule | syrup | injection | topical | inhaler",
  "mechanism": "1-2 sentence mechanism of action",
  "common_side_effects": ["..."],
  "contraindications": ["..."],
  "safety_note": "important caution in 1-2 sentences",
  "image_query": "high resolution image search query for this medicine"
}
RULES:
- Use generic names where possible.
- Do NOT provide prescription dosages.
- Always populate diseases with at least 3 specific conditions when the medicine is well-known.
- If the medicine is unknown, return name with empty strings/arrays and safety_note: "Medicine not recognized. Verify spelling or consult a pharmacist."
- Return ONLY the JSON.`;

type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];

export const lookupMedicine = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => MedicineRequestSchema.parse(raw))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { medicine: null as JsonValue, error: "LOVABLE_API_KEY is not configured" as string | null };
    }
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: MEDICINE_SYSTEM },
            { role: "user", content: `Medicine: ${data.query}\nReturn the JSON only.` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 429) return { medicine: null as JsonValue, error: "Rate limit reached. Please wait." as string | null };
        if (res.status === 402)
          return { medicine: null as JsonValue, error: "AI credits exhausted. Add credits in Workspace > Usage." as string | null };
        return { medicine: null as JsonValue, error: `Gateway error (${res.status}): ${body.slice(0, 200)}` as string | null };
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      let parsed: JsonValue = null;
      try {
        parsed = JSON.parse(content) as JsonValue;
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        parsed = m ? (JSON.parse(m[0]) as JsonValue) : null;
      }
      return { medicine: parsed, error: null as string | null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("lookupMedicine failed:", message);
      return { medicine: null as JsonValue, error: message as string | null };
    }
  });

// =====================================================
// Medicine image scanner — identify pill/strip from photo
// =====================================================

const ScanMedicineSchema = z.object({
  imageBase64: z.string().max(8_000_000),
  mimeType: z.string().max(80),
});

const SCAN_SYSTEM = `You are a pharmaceutical visual identification AI. Given a photo of a medicine (tablet, capsule, blister strip, bottle, or carton), identify it and return STRICT JSON:
{
  "name": "Most likely medicine name (brand or generic)",
  "generic_name": "",
  "drug_class": "",
  "used_for": ["primary indications"],
  "diseases": ["specific diseases this medicine is used for"],
  "dosage_form": "tablet | capsule | syrup | injection | topical | inhaler",
  "mechanism": "1-2 sentence mechanism",
  "common_side_effects": ["..."],
  "contraindications": ["..."],
  "safety_note": "important caution",
  "image_query": "search query string",
  "identification_confidence": "0-100",
  "visual_notes": "describe what you SEE: shape, color, imprint, packaging text"
}
RULES:
- Read any visible text on the packaging or pill imprint.
- If you cannot confidently identify it, set name="Unknown" and identification_confidence="0" and explain in safety_note what to do.
- Never invent a medication. Lower confidence is better than a wrong answer.
- Return ONLY the JSON.`;

export const scanMedicineImage = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => ScanMedicineSchema.parse(raw))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { medicine: null as JsonValue, error: "LOVABLE_API_KEY is not configured" as string | null };
    }
    if (!data.mimeType.startsWith("image/")) {
      return { medicine: null as JsonValue, error: "Only images are supported for scanning." as string | null };
    }
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SCAN_SYSTEM },
            {
              role: "user",
              content: [
                { type: "text", text: "Identify this medicine. Return the JSON only." },
                {
                  type: "image_url",
                  image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` },
                },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status === 429) return { medicine: null as JsonValue, error: "Rate limit reached. Please wait." as string | null };
        if (res.status === 402)
          return { medicine: null as JsonValue, error: "AI credits exhausted. Add credits in Workspace > Usage." as string | null };
        return { medicine: null as JsonValue, error: `Gateway error (${res.status}): ${body.slice(0, 200)}` as string | null };
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      let parsed: JsonValue = null;
      try {
        parsed = JSON.parse(content) as JsonValue;
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        parsed = m ? (JSON.parse(m[0]) as JsonValue) : null;
      }
      return { medicine: parsed, error: null as string | null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("scanMedicineImage failed:", message);
      return { medicine: null as JsonValue, error: message as string | null };
    }
  });

// =====================================================
// Drug interaction checker
// =====================================================

const InteractionSchema = z.object({
  medicines: z.array(z.string().min(1).max(120)).min(2).max(10),
});

const INTERACTION_SYSTEM = `You are a clinical pharmacology AI. Given a list of medicines, identify clinically relevant drug-drug interactions.
Return STRICT JSON:
{
  "interactions": [
    {
      "drugs": ["Drug A","Drug B"],
      "severity": "Minor | Moderate | Major",
      "effect": "what can happen",
      "recommendation": "how to manage / avoid"
    }
  ],
  "summary": "1-line overall risk summary"
}
RULES:
- Only include real, well-documented interactions.
- If none, return interactions: [] and summary explaining no major interactions found.
- Do NOT include dosing instructions.
- Return ONLY the JSON.`;

export const checkDrugInteractions = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => InteractionSchema.parse(raw))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const empty: JsonValue[] = [];
    if (!apiKey) return { interactions: empty, summary: "", error: "LOVABLE_API_KEY is not configured" as string | null };
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: INTERACTION_SYSTEM },
            { role: "user", content: `Medicines: ${data.medicines.join(", ")}\nReturn the JSON only.` },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return { interactions: empty, summary: "", error: `Gateway error (${res.status}): ${body.slice(0, 200)}` };
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content ?? "{}";
      let parsed: { interactions?: JsonValue[]; summary?: string } = {};
      try {
        parsed = JSON.parse(content) as typeof parsed;
      } catch {
        const m = content.match(/\{[\s\S]*\}/);
        if (m) parsed = JSON.parse(m[0]) as typeof parsed;
      }
      return {
        interactions: Array.isArray(parsed.interactions) ? (parsed.interactions as JsonValue[]) : empty,
        summary: parsed.summary ?? "",
        error: null as string | null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("checkDrugInteractions failed:", message);
      return { interactions: empty, summary: "", error: message };
    }
  });
