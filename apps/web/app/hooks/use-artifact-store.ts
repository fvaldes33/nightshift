import { create } from "zustand";

export interface Artifact {
  id: string;
  title: string;
  content: string;
}

interface ArtifactState {
  artifact: Artifact | null;
  open: (artifact: Artifact) => void;
  close: () => void;
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  artifact: null,
  open: (artifact) => set({ artifact }),
  close: () => set({ artifact: null }),
}));
