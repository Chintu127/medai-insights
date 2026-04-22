import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { Upload, FileImage, Loader2, X, User, Activity, FileText, Plus } from "lucide-react";
import { medicalStore } from "@/lib/medical-store";
import type { PatientProfile, LabAttachment } from "@/lib/medical-types";
import { analyzeMedical } from "@/server/medical-analysis.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "New Analysis — MedAI" },
      { name: "description", content: "Submit patient profile, symptoms and one or more lab reports for dual-AI analysis." },
      { property: "og:title", content: "New Analysis — MedAI" },
      { property: "og:description", content: "Submit your data for a dual-AI second opinion." },
    ],
  }),
  component: UploadPage,
});

const MAX_FILE_BYTES = 6 * 1024 * 1024;
const MAX_FILES = 5;

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      res(result.split(",")[1] ?? "");
    };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function UploadPage() {
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeMedical);
  const [patient, setPatient] = useState<PatientProfile>({
    name: "",
    age: "",
    gender: "",
    weight: "",
    history: "",
    lifestyle: "",
  });
  const [symptoms, setSymptoms] = useState("");
  const [labText, setLabText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: FileList | File[] | null) => {
    setError(null);
    if (!incoming) return;
    const list = Array.from(incoming);
    const accepted: File[] = [];
    for (const f of list) {
      if (files.length + accepted.length >= MAX_FILES) {
        setError(`Maximum ${MAX_FILES} files.`);
        break;
      }
      if (f.size > MAX_FILE_BYTES) {
        setError(`"${f.name}" too large (max 6 MB).`);
        continue;
      }
      if (!/^image\//.test(f.type) && f.type !== "application/pdf") {
        setError(`"${f.name}" is not an image or PDF.`);
        continue;
      }
      accepted.push(f);
    }
    if (accepted.length) setFiles((prev) => [...prev, ...accepted]);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const onSubmit = async () => {
    setError(null);
    if (!symptoms.trim() && !labText.trim() && files.length === 0) {
      setError("Please provide symptoms, lab text, or at least one lab report file.");
      return;
    }
    setSubmitting(true);
    try {
      const labAttachments: LabAttachment[] = [];
      for (const f of files) {
        if (f.type.startsWith("image/")) {
          const base64 = await fileToBase64(f);
          labAttachments.push({ base64, mimeType: f.type, name: f.name });
        }
        // PDFs without OCR support: name is added to text context
      }
      const pdfNames = files.filter((f) => f.type === "application/pdf").map((f) => f.name);
      const augmentedText =
        labText +
        (pdfNames.length
          ? `\n\n[Attached PDF files (text not extracted client-side): ${pdfNames.join(", ")}]`
          : "");

      const request = {
        patient,
        symptoms,
        labReportText: augmentedText || undefined,
        labAttachments: labAttachments.length ? labAttachments : undefined,
      };
      medicalStore.set({
        status: "processing",
        request,
        result: null,
        error: null,
        progress: 5,
        stage: "Submitting to dual-AI pipeline…",
      });
      navigate({ to: "/processing" });

      const tick = setInterval(() => {
        const s = medicalStore.getState();
        if (s.status !== "processing") return clearInterval(tick);
        const next = Math.min(s.progress + 4, 92);
        const stages = [
          "Extracting medical parameters…",
          "Querying Gemini…",
          "Querying GPT…",
          "Cross-checking lab values…",
          "Running comparison engine…",
        ];
        medicalStore.set({
          progress: next,
          stage: stages[Math.floor(next / 20)] ?? s.stage,
        });
      }, 700);

      const result = await analyze({ data: request });
      clearInterval(tick);
      if (result.error || !result.gemini || !result.gpt || !result.comparison) {
        medicalStore.set({
          status: "error",
          error: result.error ?? "Analysis failed",
          progress: 100,
          stage: "Error",
        });
        return;
      }
      medicalStore.set({
        status: "ready",
        result: {
          gemini: result.gemini as never,
          gpt: result.gpt as never,
          comparison: result.comparison as never,
        },
        progress: 100,
        stage: "Complete",
      });
      navigate({ to: "/results" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      medicalStore.set({ status: "error", error: msg });
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 md:px-10 py-8 max-w-5xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-2xl md:text-3xl font-semibold">New Analysis</h1>
        <p className="text-sm text-muted-foreground">
          Provide patient context, symptoms, and one or more lab reports. Both AIs receive identical input.
        </p>
      </header>

      <section className="glass-card rounded-2xl p-5 md:p-7 space-y-5">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <User className="size-4" /> Patient profile
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Name (or initials)" value={patient.name} onChange={(v) => setPatient({ ...patient, name: v })} placeholder="J.D." />
          <Field label="Age" value={patient.age} onChange={(v) => setPatient({ ...patient, age: v })} placeholder="42" />
          <Field label="Gender" value={patient.gender} onChange={(v) => setPatient({ ...patient, gender: v })} placeholder="Female / Male / Other" />
          <Field label="Weight" value={patient.weight} onChange={(v) => setPatient({ ...patient, weight: v })} placeholder="68 kg" />
          <Field label="Medical history" value={patient.history} onChange={(v) => setPatient({ ...patient, history: v })} placeholder="Hypertension, type 2 diabetes (5 yrs)" textarea />
          <Field label="Lifestyle" value={patient.lifestyle} onChange={(v) => setPatient({ ...patient, lifestyle: v })} placeholder="Sedentary, non-smoker" textarea />
        </div>
      </section>

      <section className="glass-card rounded-2xl p-5 md:p-7 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Activity className="size-4" /> Symptoms
        </div>
        <textarea
          value={symptoms}
          onChange={(e) => setSymptoms(e.target.value)}
          rows={4}
          placeholder="e.g. Persistent fatigue (2 weeks), increased thirst, blurred vision, occasional dizziness…"
          className="w-full resize-none rounded-xl bg-background border border-input px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </section>

      <section className="glass-card rounded-2xl p-5 md:p-7 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <FileText className="size-4" /> Lab reports
          </div>
          <span className="text-[11px] text-muted-foreground">{files.length}/{MAX_FILES} files</span>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-6 md:p-8 text-center ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/60 hover:bg-muted/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
          <div className="space-y-2">
            <div className="mx-auto size-12 rounded-2xl gradient-primary text-white flex items-center justify-center">
              <Upload className="size-5" />
            </div>
            <p className="text-sm font-medium">Drag & drop multiple lab reports</p>
            <p className="text-xs text-muted-foreground">JPG, PNG or PDF · max 6 MB each · up to {MAX_FILES} files</p>
          </div>
        </div>

        {files.length > 0 && (
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2"
              >
                <FileImage className="size-4 text-primary shrink-0" />
                <span className="text-sm truncate flex-1">{f.name}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {(f.size / 1024).toFixed(0)} KB
                </span>
                <button
                  onClick={() => removeFile(i)}
                  className="size-7 rounded-full hover:bg-muted flex items-center justify-center"
                  aria-label="Remove"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
            <li>
              <button
                onClick={() => inputRef.current?.click()}
                className="text-xs inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Plus className="size-3.5" /> Add more files
              </button>
            </li>
          </ul>
        )}

        <div className="text-xs text-muted-foreground -mt-1">— or paste lab values as text —</div>
        <textarea
          value={labText}
          onChange={(e) => setLabText(e.target.value)}
          rows={4}
          placeholder="Glucose: 186 mg/dL, HbA1c: 8.2%, Hemoglobin: 11.1 g/dL, Total Cholesterol: 240 mg/dL…"
          className="w-full resize-none rounded-xl bg-background border border-input px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm p-4">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          By submitting you confirm this is for educational use and not a medical decision.
        </p>
        <button
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl gradient-primary text-white font-medium glow disabled:opacity-60"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
          {submitting ? "Analyzing…" : "Run dual-AI analysis"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none rounded-xl bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </label>
  );
}
