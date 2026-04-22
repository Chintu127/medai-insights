import { jsPDF } from "jspdf";
import type { DualAIResponse, AnalysisRequest, LabValue } from "./medical-types";
import { lookupReferenceRange, inferStatus } from "./lab-reference-ranges";

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

export function generateMedicalReportPDF(
  result: DualAIResponse,
  request: AnalysisRequest | null,
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const addHeading = (text: string, size = 14) => {
    ensureSpace(size + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(20, 60, 110);
    doc.text(text, margin, y);
    y += size + 6;
    doc.setTextColor(40, 40, 40);
  };

  const addText = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {},
  ) => {
    const size = opts.size ?? 10;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    if (opts.color) doc.setTextColor(...opts.color);
    else doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(size + 2);
      doc.text(line, margin, y);
      y += size + 2;
    }
  };

  const addBullets = (items: string[]) => {
    for (const it of items) {
      const lines = doc.splitTextToSize(`• ${it}`, contentWidth - 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      for (const line of lines) {
        ensureSpace(12);
        doc.text(line, margin + 4, y);
        y += 12;
      }
    }
  };

  const divider = () => {
    ensureSpace(10);
    doc.setDrawColor(220, 228, 240);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;
  };

  // ===== Header =====
  doc.setFillColor(13, 92, 168);
  doc.rect(0, 0, pageWidth, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("MedAI — Dual-AI Medical Report", margin, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Generated ${new Date().toLocaleString()}  ·  Educational use only`,
    margin,
    52,
  );
  y = 100;
  doc.setTextColor(40, 40, 40);

  // ===== Patient =====
  if (request?.patient) {
    addHeading("Patient profile");
    const p = request.patient;
    const rows = [
      ["Name", p.name || "—"],
      ["Age", p.age || "—"],
      ["Gender", p.gender || "—"],
      ["Weight", p.weight || "—"],
      ["History", p.history || "—"],
      ["Lifestyle", p.lifestyle || "—"],
    ];
    for (const [k, v] of rows) {
      addText(`${k}: ${v}`);
    }
    if (request.symptoms) {
      y += 4;
      addText("Symptoms:", { bold: true });
      addText(request.symptoms);
    }
    divider();
  }

  // ===== Summary =====
  const { gemini, gpt, comparison } = result;
  addHeading("Summary");
  addText(`Top agreed condition: ${comparison.final_condition || "—"}`, { bold: true });
  addText(`Confidence score: ${comparison.confidence_score || "—"} / 100`);
  addText(`Agreement level: ${comparison.agreement_level || "—"}`);
  addText(`Risk level: ${gemini.risk_level || gpt.risk_level || "—"}`);
  const hs = gemini.health_score || gpt.health_score;
  if (hs) addText(`Health score: ${hs} / 100`);
  if (comparison.final_recommendation) {
    y += 2;
    addText(`Recommendation: ${comparison.final_recommendation}`);
  }
  const simplified = gemini.simplified_summary || gpt.simplified_summary;
  if (simplified) {
    y += 4;
    addText("Plain-language summary:", { bold: true });
    addText(simplified);
  }
  divider();

  // ===== Possible conditions =====
  addHeading("Possible conditions");
  const conds = [
    ...(gemini.possible_conditions ?? []).map((c) => ({ ...c, src: "Gemini" })),
    ...(gpt.possible_conditions ?? []).map((c) => ({ ...c, src: "GPT" })),
  ];
  if (conds.length === 0) addText("No conditions identified.");
  for (const c of conds) {
    addText(`${c.name}  (${c.src} · ${c.probability})`, { bold: true });
    if (c.reasoning) addText(c.reasoning);
    y += 2;
  }
  const secondary = Array.from(
    new Set([...(gemini.secondary_conditions ?? []), ...(gpt.secondary_conditions ?? [])]),
  );
  if (secondary.length) {
    y += 2;
    addText("Secondary risks to monitor:", { bold: true });
    addBullets(secondary);
  }
  divider();

  // ===== Explainable AI =====
  const explainables = [
    ...(gemini.explainable_findings ?? []),
    ...(gpt.explainable_findings ?? []),
  ];
  if (explainables.length) {
    addHeading("Why these conditions? (Explainable AI)");
    for (const f of explainables) {
      addText(`${f.finding}  →  ${f.implies}`, { bold: true });
      if (f.why) addText(f.why, { color: [90, 90, 90] });
      y += 2;
    }
    divider();
  }

  // ===== Lab values (with reference range fallback) =====
  addHeading("Lab values");
  const rawLabs = (gemini.parsed_labs?.length ? gemini.parsed_labs : gpt.parsed_labs) ?? [];
  const parsedLabs = enrichLabs(rawLabs);
  if (parsedLabs.length > 0) {
    ensureSpace(20);
    doc.setFillColor(240, 246, 255);
    doc.rect(margin, y - 2, contentWidth, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(20, 60, 110);
    doc.text("Parameter", margin + 4, y + 9);
    doc.text("Value", margin + 180, y + 9);
    doc.text("Range", margin + 270, y + 9);
    doc.text("Status", margin + 380, y + 9);
    y += 18;
    doc.setTextColor(40, 40, 40);
    for (const lab of parsedLabs) {
      ensureSpace(14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const name = doc.splitTextToSize(lab.name || "—", 170)[0];
      doc.text(name, margin + 4, y + 9);
      doc.text(`${lab.value ?? "—"}${lab.unit ? " " + lab.unit : ""}`, margin + 180, y + 9);
      doc.text(lab.reference_range || "—", margin + 270, y + 9);
      const status = lab.status || "—";
      const isAbn = /high|low|critical|abnormal/i.test(status);
      if (isAbn) doc.setTextColor(180, 40, 40);
      else doc.setTextColor(30, 130, 80);
      doc.text(status, margin + 380, y + 9);
      doc.setTextColor(40, 40, 40);
      y += 14;
      if (lab.interpretation) {
        addText(`   ${lab.interpretation}`, { size: 8, color: [110, 110, 110] });
      }
    }
  } else {
    const extracted = gemini.extracted_data ?? {};
    const entries = Object.entries(extracted);
    if (entries.length === 0) addText("No lab values extracted.");
    for (const [k, v] of entries) {
      addText(`${k.replace(/_/g, " ")}: ${String(v)}`);
    }
  }

  if ((gemini.abnormal_findings?.length ?? 0) > 0) {
    y += 6;
    addText("Abnormal findings:", { bold: true });
    addBullets(gemini.abnormal_findings);
  }
  divider();

  // ===== Comparison =====
  addHeading("Dual-AI comparison");
  addText("Gemini analysis", { bold: true });
  addText(`Risk: ${gemini.risk_level || "—"}  ·  Confidence: ${gemini.confidence_score || "—"}`);
  addText(`Specialist: ${gemini.doctor_recommendation || "General Physician"}`);
  y += 4;
  addText("GPT analysis", { bold: true });
  addText(`Risk: ${gpt.risk_level || "—"}  ·  Confidence: ${gpt.confidence_score || "—"}`);
  addText(`Specialist: ${gpt.doctor_recommendation || "General Physician"}`);
  if (comparison.disagreement_notes) {
    y += 4;
    addText("Disagreement notes:", { bold: true });
    addText(comparison.disagreement_notes);
  }
  const dsMatch = gemini.dataset_match || gpt.dataset_match;
  if (dsMatch) {
    y += 4;
    addText(`Dataset match: ${dsMatch}`, { bold: true });
  }
  divider();

  // ===== Medications =====
  const meds = Array.from(
    new Set([...(gemini.medications_suggestion ?? []), ...(gpt.medications_suggestion ?? [])]),
  );
  if (meds.length) {
    addHeading("Medication suggestions (generic, educational)");
    addBullets(meds);
    divider();
  }

  // ===== Tests & lifestyle =====
  const tests = Array.from(new Set([...(gemini.recommended_tests ?? []), ...(gpt.recommended_tests ?? [])]));
  if (tests.length) {
    addHeading("Recommended next tests");
    addBullets(tests);
    divider();
  }

  const lifestyle = Array.from(
    new Set([...(gemini.lifestyle_advice ?? []), ...(gpt.lifestyle_advice ?? [])]),
  );
  if (lifestyle.length) {
    addHeading("Lifestyle advice");
    addBullets(lifestyle);
    divider();
  }

  const warnings = Array.from(new Set([...(gemini.warnings ?? []), ...(gpt.warnings ?? [])]));
  if (warnings.length) {
    addHeading("Warnings");
    addBullets(warnings);
    divider();
  }

  // ===== Disclaimer =====
  addHeading("Disclaimer", 12);
  addText(
    "This report is generated by AI for educational purposes only. It is not a medical diagnosis and must not be used as a substitute for professional clinical judgment. Always consult a licensed healthcare provider before making any medical decisions.",
    { size: 9, color: [100, 100, 100] },
  );

  // ===== Page numbers =====
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`MedAI Report  ·  Page ${i} of ${total}`, pageWidth - margin, pageHeight - 20, {
      align: "right",
    });
  }

  return doc;
}
