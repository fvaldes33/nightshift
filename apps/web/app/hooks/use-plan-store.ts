import { create } from "zustand";

export interface Plan {
  filePath: string;
  title: string;
  content: string;
}

interface PlanState {
  plan: Plan | null;
  open: (plan: Plan) => void;
  close: () => void;
}

export const usePlanStore = create<PlanState>((set) => ({
  plan: null,
  open: (plan) => set({ plan }),
  close: () => set({ plan: null }),
}));
