import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { useState } from "react";
import { CompactToolRenderer } from "./compact-tool-renderers";
import type { AnyToolPart } from "./types";

const VISIBLE_THRESHOLD = 6;
const HEAD_COUNT = 3;
const TAIL_COUNT = 3;

interface ToolCallGroupProps {
  parts: { part: AnyToolPart; index: number }[];
}

export function ToolCallGroup({ parts }: ToolCallGroupProps) {
  const [expanded, setExpanded] = useState(false);

  if (parts.length <= VISIBLE_THRESHOLD) {
    return (
      <div className="divide-y divide-border/50 rounded-md border">
        {parts.map(({ part, index }) => (
          <CompactToolRenderer key={index} part={part} />
        ))}
      </div>
    );
  }

  const head = parts.slice(0, HEAD_COUNT);
  const middle = parts.slice(HEAD_COUNT, parts.length - TAIL_COUNT);
  const tail = parts.slice(parts.length - TAIL_COUNT);
  const hiddenCount = middle.length;

  return (
    <div className="divide-y divide-border/50 rounded-md border">
      {head.map(({ part, index }) => (
        <CompactToolRenderer key={index} part={part} />
      ))}

      {expanded && middle.map(({ part, index }) => (
        <CompactToolRenderer key={index} part={part} />
      ))}

      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full cursor-pointer items-center gap-2 py-1 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
      >
        <span className="h-px flex-1 border-t border-dashed border-muted-foreground/30" />
        <span className="flex items-center gap-1">
          {expanded ? "collapse" : `${hiddenCount} more tools`}
          {expanded ? (
            <ChevronUpIcon className="size-3" />
          ) : (
            <ChevronDownIcon className="size-3" />
          )}
        </span>
        <span className="h-px flex-1 border-t border-dashed border-muted-foreground/30" />
      </button>

      {tail.map(({ part, index }) => (
        <CompactToolRenderer key={index} part={part} />
      ))}
    </div>
  );
}
