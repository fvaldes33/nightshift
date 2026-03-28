import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openralph/ui/components/collapsible";
import { cn } from "@openralph/ui/lib/utils";
import {
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import type { ToolPart } from "./tool";

export type CompactToolProps = ComponentProps<typeof Collapsible>;

export const CompactTool = ({ className, ...props }: CompactToolProps) => (
  <Collapsible
    className={cn("not-prose group/compact w-full min-w-0", className)}
    {...props}
  />
);

export type CompactToolEntryProps = ComponentProps<typeof CollapsibleTrigger>;

export const CompactToolEntry = ({
  className,
  ...props
}: CompactToolEntryProps) => (
  <CollapsibleTrigger
    className={cn(
      "flex w-full cursor-pointer items-center gap-2 py-1.5 px-3 text-sm hover:bg-muted/50 transition-colors",
      className,
    )}
    {...props}
  />
);

export type CompactToolIconProps = ComponentProps<"span">;

export const CompactToolIcon = ({
  className,
  ...props
}: CompactToolIconProps) => (
  <span
    className={cn(
      "flex shrink-0 items-center text-muted-foreground [&>svg]:size-3.5",
      className,
    )}
    {...props}
  />
);

export type CompactToolNameProps = ComponentProps<"span">;

export const CompactToolName = ({
  className,
  ...props
}: CompactToolNameProps) => (
  <span
    className={cn(
      "shrink-0 font-mono text-xs font-medium",
      className,
    )}
    {...props}
  />
);

export type CompactToolDetailProps = ComponentProps<"span">;

export const CompactToolDetail = ({
  className,
  ...props
}: CompactToolDetailProps) => (
  <span
    className={cn(
      "min-w-0 truncate text-xs text-muted-foreground",
      className,
    )}
    {...props}
  />
);

export type CompactToolStatusProps = ComponentProps<"span"> & {
  state: ToolPart["state"];
};

export const compactStatusIcons: Record<ToolPart["state"], ReactNode> = {
  "input-streaming": (
    <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
  ),
  "input-available": (
    <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
  ),
  "output-available": (
    <CheckIcon className="size-3.5 text-muted-foreground" />
  ),
  "output-error": <XCircleIcon className="size-3.5 text-red-500" />,
  "output-denied": <XCircleIcon className="size-3.5 text-orange-500" />,
  "approval-requested": <ClockIcon className="size-3.5 text-yellow-500" />,
  "approval-responded": (
    <CheckCircleIcon className="size-3.5 text-blue-500" />
  ),
};

export const CompactToolStatus = ({
  className,
  state,
  ...props
}: CompactToolStatusProps) => (
  <span
    className={cn("ml-auto flex shrink-0 items-center", className)}
    {...props}
  >
    {compactStatusIcons[state]}
  </span>
);

export type CompactToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const CompactToolContent = ({
  className,
  ...props
}: CompactToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground data-[state=closed]:animate-out data-[state=open]:animate-in w-full overflow-hidden outline-none",
      className,
    )}
    {...props}
  />
);

CompactTool.displayName = "CompactTool";
CompactToolEntry.displayName = "CompactToolEntry";
CompactToolIcon.displayName = "CompactToolIcon";
CompactToolName.displayName = "CompactToolName";
CompactToolDetail.displayName = "CompactToolDetail";
CompactToolStatus.displayName = "CompactToolStatus";
CompactToolContent.displayName = "CompactToolContent";
