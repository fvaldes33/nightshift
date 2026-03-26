import { RepeatIcon } from "lucide-react";
import { useParams } from "react-router";
import { AppHeader } from "~/components/app-header";
import { LoopListItem } from "~/components/loops/loop-list-item";
import { useLoops } from "~/hooks/use-collection";

export function meta() {
  return [{ title: "Loops — nightshift" }];
}

export default function Loops() {
  const params = useParams();
  const repoId = params.repoId!;
  const { data: loops } = useLoops({ repoId });

  if (loops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <RepeatIcon className="text-muted-foreground mb-4 size-12" />
        <h3 className="text-lg font-semibold">No loops yet</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Loops are started from within a session.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <AppHeader>
        <h1 className="text-sm font-semibold">Loops</h1>
        <span className="text-muted-foreground text-xs tabular-nums">{loops.length}</span>
      </AppHeader>
      <div className="flex-1 overflow-auto">
        <div className="grid gap-0.5 p-4">
          {loops.map((l) => (
            <LoopListItem
              key={l.id}
              loop={l}
              to={`/repos/${repoId}/loops/${l.id}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
