import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "../../lib/utils";

const plugins = { cjk, code, math, mermaid };

export type MarkdownContentProps = ComponentProps<"div"> & {
  children: string;
};

export function MarkdownContent({ className, children, ...props }: MarkdownContentProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)} {...props}>
      <Streamdown className="grid gap-2" plugins={plugins}>
        {children}
      </Streamdown>
    </div>
  );
}
