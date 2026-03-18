"use client";

import { useClipboard } from "@mantine/hooks";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface ClipboardProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function Clipboard({ value, children, className }: ClipboardProps) {
  const { copy, copied } = useClipboard({ timeout: 1500 });

  return (
    <button
      type="button"
      onClick={() => copy(value)}
      className={cn(
        "group inline-flex min-w-0 max-w-full cursor-pointer items-center gap-1.5",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {copied ? (
        <CheckIcon className="size-3 shrink-0 text-green-500" />
      ) : (
        <CopyIcon className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </button>
  );
}
