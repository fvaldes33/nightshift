import { Loader2Icon, SearchIcon, XCircleIcon } from "lucide-react";
import { useExplorationStore } from "~/hooks/use-exploration-store";

export function ExplorationStream() {
  const { status, tool, elapsed } = useExplorationStore();

  if (!status) return null;

  return (
    <div className="border-border/50 bg-muted/30 mx-auto flex w-full max-w-2xl items-center gap-2 rounded-md border px-3 py-2 text-xs">
      {status === "running" ? (
        <Loader2Icon className="text-muted-foreground size-3 animate-spin" />
      ) : status === "error" ? (
        <XCircleIcon className="text-destructive-foreground size-3" />
      ) : (
        <SearchIcon className="text-muted-foreground size-3" />
      )}
      <span className="text-muted-foreground">
        {status === "running"
          ? `Exploring${tool ? ` — ${tool}` : ""}...`
          : status === "error"
            ? "Exploration failed"
            : "Exploration complete"}
      </span>
      <span className="text-muted-foreground/60 ml-auto font-mono tabular-nums">{elapsed}s</span>
    </div>
  );
}
