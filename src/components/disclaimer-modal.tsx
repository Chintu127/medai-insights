import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const KEY = "medai-disclaimer-v1";

export function DisclaimerModal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(KEY)) setOpen(true);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4">
      <div className="glass-card max-w-lg w-full rounded-2xl p-6 relative">
        <button
          onClick={() => {
            localStorage.setItem(KEY, "1");
            setOpen(false);
          }}
          className="absolute top-3 right-3 size-8 rounded-lg hover:bg-muted flex items-center justify-center"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3 mb-4">
          <div className="size-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center shrink-0">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">Important — read before continuing</h2>
            <p className="text-sm text-muted-foreground mt-1">
              MedAI is an educational research prototype.
            </p>
          </div>
        </div>
        <ul className="text-sm space-y-2 text-foreground/90 list-disc pl-5 mb-6">
          <li>This tool does <b>not</b> provide a medical diagnosis.</li>
          <li>Outputs are AI-generated and may be inaccurate or incomplete.</li>
          <li>Never use it to make treatment decisions.</li>
          <li>For emergencies (chest pain, stroke signs, severe bleeding) call your local emergency number.</li>
          <li>Always consult a licensed healthcare professional.</li>
        </ul>
        <button
          onClick={() => {
            localStorage.setItem(KEY, "1");
            setOpen(false);
          }}
          className="w-full h-11 rounded-xl gradient-primary text-white font-medium glow"
        >
          I understand and acknowledge
        </button>
      </div>
    </div>
  );
}
