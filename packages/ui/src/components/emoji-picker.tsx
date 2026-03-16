import { EmojiPicker } from "frimousse";
import { Smile } from "lucide-react";

import { cn } from "@openralph/ui/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

function EmojiPickerContent({ onEmojiSelect }: { onEmojiSelect: (emoji: string) => void }) {
  return (
    <EmojiPicker.Root
      onEmojiSelect={(emoji) => onEmojiSelect(emoji.emoji)}
      columns={8}
      className="flex flex-col"
    >
      <EmojiPicker.Search
        className="bg-background text-foreground placeholder:text-muted-foreground border-input mx-2 mt-2 rounded-md border px-2 py-1.5 text-sm outline-none"
        placeholder="Search emoji..."
        autoFocus
      />
      <EmojiPicker.Viewport className="relative h-56 overflow-y-auto overflow-x-hidden px-1 py-1">
        <EmojiPicker.Loading className="text-muted-foreground flex h-full items-center justify-center text-sm">
          Loading...
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="text-muted-foreground flex h-full items-center justify-center text-sm">
          No emoji found.
        </EmojiPicker.Empty>
        <EmojiPicker.List
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                {...props}
                className="bg-popover text-muted-foreground sticky top-0 z-10 px-1 py-1 text-xs font-medium"
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div {...props} className="flex">
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                {...props}
                className={cn(
                  "flex size-8 items-center justify-center rounded text-lg",
                  emoji.isActive && "bg-accent",
                )}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}

function EmojiInput({
  value,
  onChange,
  className,
}: {
  value: string | undefined;
  onChange: (emoji: string | undefined) => void;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "border-input shadow-xs flex h-9 items-center justify-center rounded-md border px-2 text-sm",
            className,
          )}
        >
          {value ? (
            <span className="text-base leading-none">{value}</span>
          ) : (
            <Smile className="text-muted-foreground size-4" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <EmojiPickerContent onEmojiSelect={(emoji) => onChange(emoji)} />
      </PopoverContent>
    </Popover>
  );
}

export { EmojiInput, EmojiPickerContent };
