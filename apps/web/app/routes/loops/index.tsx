import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import { Progress } from "@openralph/ui/components/progress";
import { PlusIcon, RepeatIcon } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { StartLoopDialog } from "~/components/start-loop-dialog";
import { useLoops } from "~/hooks/use-collection";

const statusColor: Record<string, string> = {
  running: "bg-green-500",
  queued: "bg-yellow-500",
  complete: "bg-muted-foreground",
  failed: "bg-destructive-foreground",
};

export function meta() {
  return [{ title: "Loops — nightshift" }];
}

export default function Loops() {
  const params = useParams();
  const repoId = params.repoId!;
  const { data: loops } = useLoops({ repoId });
  const [startOpen, setStartOpen] = useState(false);

  if (loops.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24">
          <RepeatIcon className="text-muted-foreground mb-4 size-12" />
          <h3 className="text-lg font-semibold">No loops yet</h3>
          <p className="text-muted-foreground mb-4 mt-1 text-sm">
            Start a loop to run autonomous coding iterations.
          </p>
          <Button size="sm" className="h-8" onClick={() => setStartOpen(true)}>
            <PlusIcon className="size-3.5" />
            Start Loop
          </Button>
        </div>
        <StartLoopDialog open={startOpen} onOpenChange={setStartOpen} repoId={repoId} />
      </>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="border-border flex shrink-0 items-center gap-2 border-b p-4">
          <h1 className="text-sm font-semibold">Loops</h1>
          <span className="text-muted-foreground text-xs tabular-nums">{loops.length}</span>
          <div className="flex-1" />
          <Button size="sm" className="h-8" onClick={() => setStartOpen(true)}>
            <PlusIcon className="size-3.5" />
            Start Loop
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          <div className="grid gap-1 p-4">
            {loops.map((l) => (
              <Link
                key={l.id}
                to={`/repos/${repoId}/loops/${l.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent/50 transition-colors"
              >
                <span
                  className={`size-2 shrink-0 rounded-full ${statusColor[l.status] ?? "bg-muted-foreground"}`}
                />
                <span className="flex-1 truncate text-sm">{l.name}</span>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {l.currentIteration}/{l.maxIterations}
                </Badge>
                <Progress
                  value={l.maxIterations > 0 ? (l.currentIteration / l.maxIterations) * 100 : 0}
                  className="w-16 h-1.5"
                />
              </Link>
            ))}
          </div>
        </div>
      </div>
      <StartLoopDialog open={startOpen} onOpenChange={setStartOpen} repoId={repoId} />
    </>
  );
}
