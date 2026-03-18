import { create } from "zustand";

interface ExplorationState {
  status: "running" | "complete" | "error" | null;
  tool: string | null;
  elapsed: number;
}

interface ExplorationStore extends ExplorationState {
  update: (data: { status: "running" | "complete" | "error"; tool: string | null; elapsed: number }) => void;
  clear: () => void;
}

export const useExplorationStore = create<ExplorationStore>((set) => ({
  status: null,
  tool: null,
  elapsed: 0,
  update: (data) => set(data),
  clear: () => set({ status: null, tool: null, elapsed: 0 }),
}));
