import { useSyncExternalStore } from "react";
import type { AnalysisRequest, DualAIResponse } from "./medical-types";

type Status = "idle" | "processing" | "ready" | "error";

interface MedicalState {
  status: Status;
  request: AnalysisRequest | null;
  result: DualAIResponse | null;
  error: string | null;
  progress: number;
  stage: string;
}

const initial: MedicalState = {
  status: "idle",
  request: null,
  result: null,
  error: null,
  progress: 0,
  stage: "Idle",
};

let state: MedicalState = initial;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const medicalStore = {
  getState: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  set(partial: Partial<MedicalState>) {
    state = { ...state, ...partial };
    notify();
  },
  reset() {
    state = initial;
    notify();
  },
};

export function useMedicalState() {
  return useSyncExternalStore(
    medicalStore.subscribe,
    medicalStore.getState,
    medicalStore.getState,
  );
}
