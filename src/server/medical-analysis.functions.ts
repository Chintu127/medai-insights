import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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
});

type AnalysisInput = z.infer<typeof RequestSchema>;

const SYSTEM_PROMPT = `You are an advanced AI Medical Analysis System used in a Dual-AI verification pipeline (MedAI).

STRICT RULES:
- Do NOT provide a final diagnosis. Provide "Possible Conditions" only.
- Always include reasoning and highlight uncertainty.
- Use medically accurate terminology and standard reference ranges.
- Never hallucinate missing data. If data is missing, write "Insufficient data".
- Provide generic medication suggestions ONLY (no prescription dosages).
- Output STRICTLY valid JSON matching the provided schema. No prose outside JSON.

Schema:
{
  "extracted_data": { ... key/value lab + vitals ... },
  "abnormal_findings": [ "..." ],
  "possible_conditions": [ { "name":"", "probability":"e.g. 72%", "reasoning":"" } ],
  "risk_level": "Low" | "Medium" | "High",
  "confidence_score": "0-100",
  "recommended_tests": [ "..." ],
  "medications_suggestion": [ "generic name - purpose" ],
  "lifestyle_advice": [ "..." ],
  "warnings": [ "..." ],
  "doctor_recommendation": "e.g. Endocrinologist"
}

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

Return ONLY the JSON object, no markdown fences.`;
  parts.push({ type: "text", text });

  if (input.labReportImageBase64 && input.labReportMimeType?.startsWith("image/")) {
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
