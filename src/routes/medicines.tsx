import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pill, Search, Loader2, AlertTriangle, ShieldAlert, Activity } from "lucide-react";
import { lookupMedicine } from "@/server/medical-analysis.functions";
import type { MedicineInfo } from "@/lib/medical-types";

export const Route = createFileRoute("/medicines")({
  head: () => ({
    meta: [
      { title: "Medicine Lookup — MedAI" },
      {
        name: "description",
        content: "Look up generic medicines, their drug class, conditions treated, side effects and safety notes.",
      },
      { property: "og:title", content: "Medicine Lookup — MedAI" },
      {
        property: "og:description",
        content: "AI-powered drug information: uses, diseases treated, mechanism, side effects, contraindications.",
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

function MedicinesPage() {
  const lookup = useServerFn(lookupMedicine);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medicine, setMedicine] = useState<MedicineInfo | null>(null);

  const onSearch = async (q?: string) => {
    const term = (q ?? query).trim();
    if (!term) return;
    setQuery(term);
    setLoading(true);
    setError(null);
    setMedicine(null);
    try {
      const res = await lookup({ data: { query: term } });
      if (res.error || !res.medicine) {
        setError(res.error ?? "No information returned.");
      } else {
        setMedicine(res.medicine as MedicineInfo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 md:px-10 py-8 max-w-5xl mx-auto space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Pill className="size-6 text-primary" /> Medicine Lookup
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter a medicine to see what it treats, its drug class, mechanism and safety notes — generic
          information only, never a prescription.
        </p>
      </header>

      <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs flex items-start gap-2">
        <AlertTriangle className="size-4 mt-0.5 shrink-0 text-warning" />
        Educational reference only. Always confirm dosage and suitability with a licensed pharmacist or doctor.
      </div>

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
            {loading ? "Searching…" : "Search"}
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

      {medicine && (
        <section className="glass-card rounded-2xl p-5 md:p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Medicine</div>
              <h2 className="font-display text-2xl font-semibold">{medicine.name}</h2>
              {medicine.generic_name && medicine.generic_name.toLowerCase() !== medicine.name.toLowerCase() && (
                <div className="text-sm text-muted-foreground">Generic: {medicine.generic_name}</div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
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
      )}
    </div>
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
