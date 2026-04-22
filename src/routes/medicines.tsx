import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Pill,
  Search,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Activity,
  Camera,
  Upload,
  X,
  ShieldCheck,
} from "lucide-react";
import {
  lookupMedicine,
  scanMedicineImage,
  checkDrugInteractions,
} from "@/server/medical-analysis.functions";
import type { ScannedMedicine, DrugInteraction } from "@/lib/medical-types";

export const Route = createFileRoute("/medicines")({
  head: () => ({
    meta: [
      { title: "Medicine Lookup & Scanner — MedAI" },
      {
        name: "description",
        content:
          "Look up generic medicines, scan a pill or strip with your camera, and check drug-drug interactions.",
      },
      { property: "og:title", content: "Medicine Lookup & Scanner — MedAI" },
      {
        property: "og:description",
        content: "AI medicine identification, disease mapping, and interaction checker.",
      },
    ],
  }),
  component: MedicinesPage,
});

const SUGGESTIONS = [
  "Metformin",
  "Atorvastatin",
  "Amlodipine",
  "Paracetamol",
  "Omeprazole",
  "Salbutamol",
  "Levothyroxine",
  "Amoxicillin",
];

const MAX_BYTES = 6 * 1024 * 1024;

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

function MedicinesPage() {
  const lookup = useServerFn(lookupMedicine);
  const scan = useServerFn(scanMedicineImage);
  const checkInter = useServerFn(checkDrugInteractions);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medicines, setMedicines] = useState<ScannedMedicine[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [interactionSummary, setInteractionSummary] = useState<string>("");
  const [checkingInter, setCheckingInter] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMedicine = (m: ScannedMedicine, preview?: string) => {
    setMedicines((prev) => [m, ...prev]);
    if (preview) setPreviews((prev) => [preview, ...prev]);
    else setPreviews((prev) => ["", ...prev]);
    // Auto-clear interactions to force re-check
    setInteractions([]);
    setInteractionSummary("");
  };

  const removeMedicine = (idx: number) => {
    setMedicines((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
    setInteractions([]);
    setInteractionSummary("");
  };

  const onSearch = async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setQuery("");
    setLoading(true);
    setError(null);
    try {
      const res = await lookup({ data: { query: term } });
      if (res.error || !res.medicine) {
        setError(res.error ?? "No information returned.");
      } else {
        addMedicine(res.medicine as unknown as ScannedMedicine);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const onScanFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setScanning(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          setError(`"${file.name}" too large (max 6 MB).`);
          continue;
        }
        if (!file.type.startsWith("image/")) {
          setError(`"${file.name}" is not an image.`);
          continue;
        }
        const base64 = await fileToBase64(file);
        const preview = `data:${file.type};base64,${base64}`;
        const res = await scan({ data: { imageBase64: base64, mimeType: file.type } });
        if (res.error || !res.medicine) {
          setError(res.error ?? "Scan failed");
          continue;
        }
        addMedicine(res.medicine as unknown as ScannedMedicine, preview);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onCheckInteractions = async () => {
    const names = medicines.map((m) => m.generic_name || m.name).filter(Boolean);
    if (names.length < 2) {
      setError("Add at least 2 medicines to check interactions.");
      return;
    }
    setCheckingInter(true);
    setError(null);
    try {
      const res = await checkInter({ data: { medicines: names } });
      if (res.error) setError(res.error);
      setInteractions((res.interactions as unknown as DrugInteraction[]) ?? []);
      setInteractionSummary(res.summary ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Interaction check failed");
    } finally {
      setCheckingInter(false);
    }
  };

  return (
    <div className="px-4 md:px-10 py-8 max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Pill className="size-6 text-primary" /> Medicine Lookup & Scanner
        </h1>
        <p className="text-sm text-muted-foreground">
          Search by name, scan a pill or strip with your camera, and check drug-drug interactions across
          everything you've added.
        </p>
      </header>

      <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs flex items-start gap-2">
        <AlertTriangle className="size-4 mt-0.5 shrink-0 text-warning" />
        Educational reference only. Image identification can be wrong — always verify with a pharmacist.
      </div>

      {/* Scanner */}
      <section className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Camera className="size-4" /> Scan a medicine
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => onScanFiles(e.target.files)}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-muted/40 p-6 transition-all disabled:opacity-60"
          >
            {scanning ? (
              <Loader2 className="size-6 text-primary animate-spin" />
            ) : (
              <Upload className="size-6 text-primary" />
            )}
            <span className="text-sm font-medium">{scanning ? "Identifying…" : "Upload pill / strip image"}</span>
            <span className="text-[11px] text-muted-foreground">JPG, PNG · up to 6 MB · multiple OK</span>
          </button>
          <div className="rounded-xl border border-border p-4 space-y-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-medical" /> Tips for best results
            </div>
            <ul className="space-y-1 list-disc pl-4">
              <li>Show the imprint, brand text, or strip clearly.</li>
              <li>Avoid glare; use natural light when possible.</li>
              <li>Crop to one medicine per photo when you can.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Text search */}
      <section className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="e.g. Metformin, Atorvastatin, Salbutamol…"
              className="w-full h-11 pl-9 pr-3 rounded-xl bg-background border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => onSearch()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-5 h-11 rounded-xl gradient-primary text-white font-medium glow disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {loading ? "Searching…" : "Add by name"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSearch(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm p-4">
          {error}
        </div>
      )}

      {/* Drug interaction checker */}
      {medicines.length >= 2 && (
        <section className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                <ShieldAlert className="size-4 text-warning" /> Drug interaction checker
              </div>
              <p className="text-xs text-muted-foreground">
                Checks {medicines.length} medicines for clinically relevant interactions.
              </p>
            </div>
            <button
              onClick={onCheckInteractions}
              disabled={checkingInter}
              className="text-sm inline-flex items-center gap-2 px-4 h-10 rounded-lg gradient-primary text-white font-medium glow disabled:opacity-60"
            >
              {checkingInter ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
              {checkingInter ? "Checking…" : "Check interactions"}
            </button>
          </div>
          {interactionSummary && (
            <p className="text-xs text-muted-foreground">{interactionSummary}</p>
          )}
          {interactions.length > 0 && (
            <ul className="space-y-2">
              {interactions.map((it, i) => {
                const sev = (it.severity ?? "").toLowerCase();
                const tone =
                  sev.includes("major")
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : sev.includes("moderate")
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-border bg-muted/40 text-foreground";
                return (
                  <li key={i} className={`rounded-xl border p-3 text-sm space-y-1 ${tone}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-background/60 border border-current">
                        {it.severity}
                      </span>
                      <span className="font-medium">{(it.drugs ?? []).join(" + ")}</span>
                    </div>
                    <p className="text-xs">{it.effect}</p>
                    <p className="text-xs opacity-80">→ {it.recommendation}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* Medicines list */}
      {medicines.length > 0 && (
        <div className="space-y-4">
          {medicines.map((medicine, idx) => (
            <MedicineCard
              key={idx}
              medicine={medicine}
              preview={previews[idx]}
              onRemove={() => removeMedicine(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MedicineCard({
  medicine,
  preview,
  onRemove,
}: {
  medicine: ScannedMedicine;
  preview?: string;
  onRemove: () => void;
}) {
  const conf = medicine.identification_confidence;
  return (
    <section className="glass-card rounded-2xl p-5 md:p-6 space-y-5 relative">
      <button
        onClick={onRemove}
        className="absolute top-3 right-3 size-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
        aria-label="Remove"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-wrap items-start gap-4">
        {preview ? (
          <img
            src={preview}
            alt={medicine.name}
            className="size-20 rounded-xl object-cover border border-border"
          />
        ) : (
          <div className="size-20 rounded-xl gradient-primary text-white flex items-center justify-center">
            <Pill className="size-8" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Medicine</div>
          <h2 className="font-display text-2xl font-semibold leading-tight">{medicine.name || "Unknown"}</h2>
          {medicine.generic_name &&
            medicine.generic_name.toLowerCase() !== medicine.name?.toLowerCase() && (
              <div className="text-sm text-muted-foreground">Generic: {medicine.generic_name}</div>
            )}
          <div className="flex flex-wrap gap-2 mt-2">
            {medicine.drug_class && (
              <span className="text-xs px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
                {medicine.drug_class}
              </span>
            )}
            {medicine.dosage_form && (
              <span className="text-xs px-3 py-1 rounded-full bg-medical/15 text-medical-foreground border border-medical/30">
                {medicine.dosage_form}
              </span>
            )}
            {conf && (
              <span className="text-xs px-3 py-1 rounded-full bg-warning/15 text-warning border border-warning/30">
                ID confidence: {conf}
              </span>
            )}
          </div>
          {medicine.visual_notes && (
            <p className="text-xs text-muted-foreground mt-2 italic">"{medicine.visual_notes}"</p>
          )}
        </div>
      </div>

      {medicine.mechanism && (
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            Mechanism of action
          </div>
          <p className="text-sm leading-relaxed">{medicine.mechanism}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <InfoBlock title="Used for" items={medicine.used_for} icon={<Activity className="size-3.5" />} />
        <InfoBlock
          title="Diseases / conditions"
          items={medicine.diseases}
          icon={<Pill className="size-3.5" />}
          accent="medical"
        />
        <InfoBlock title="Common side effects" items={medicine.common_side_effects} />
        <InfoBlock
          title="Contraindications"
          items={medicine.contraindications}
          icon={<ShieldAlert className="size-3.5" />}
          accent="destructive"
        />
      </div>

      {medicine.safety_note && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm flex items-start gap-2">
          <ShieldAlert className="size-4 mt-0.5 shrink-0 text-warning" />
          <span>{medicine.safety_note}</span>
        </div>
      )}
    </section>
  );
}

function InfoBlock({
  title,
  items,
  icon,
  accent,
}: {
  title: string;
  items?: string[];
  icon?: React.ReactNode;
  accent?: "primary" | "medical" | "destructive";
}) {
  const titleColor =
    accent === "destructive"
      ? "text-destructive"
      : accent === "medical"
        ? "text-medical-foreground"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border p-4 space-y-2">
      <div className={`text-xs uppercase tracking-wider flex items-center gap-1.5 ${titleColor}`}>
        {icon}
        {title}
      </div>
      {items && items.length > 0 ? (
        <ul className="text-sm space-y-1 list-disc pl-5">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Not specified.</p>
      )}
    </div>
  );
}
