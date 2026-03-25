import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "../../lib/utils";
import { linkSafetyConfig } from "./streamdown-link-safety";
import { streamdownPlugins } from "./streamdown-plugins";

export type StreamdownProps = ComponentProps<typeof Streamdown>;

export type MarkdownContentProps = ComponentProps<"div"> &
  StreamdownProps & {
    children?: string;
  };

export function MarkdownContent({ className, ...props }: MarkdownContentProps) {
  return (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_pre]:max-w-full [&_pre]:overflow-x-auto",
        // bulleted lists should have some margin-left
        "[&_ol]:ml-5 [&_ul]:ml-4",
        // ordered list should show numbers
        "[&_ol]:list-decimal [&_ul]:list-disc",
        className,
      )}
      plugins={streamdownPlugins}
      linkSafety={linkSafetyConfig}
      {...props}
    />
  );
}
