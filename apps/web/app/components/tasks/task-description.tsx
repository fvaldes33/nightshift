import { MarkdownContent } from "@openralph/ui/ai/markdown-content";
import { MarkdownEditor } from "@openralph/ui/components/markdown-editor";
import { useRef, useState } from "react";

interface TaskDescriptionProps {
  value: string;
  onUpdate: (fields: { description: string | undefined }) => void;
}

export function TaskDescription({ value, onUpdate }: TaskDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const originalRef = useRef(value);

  // Sync when server value changes
  if (value !== originalRef.current) {
    originalRef.current = value;
    setLocalValue(value);
  }

  function save() {
    setIsEditing(false);
    const trimmed = localValue.trim();
    if (trimmed !== value) {
      onUpdate({ description: trimmed || undefined });
    }
  }

  if (isEditing) {
    return (
      <div
        className="border-border -mx-4 rounded-md border focus-within:ring-1 focus-within:ring-ring"
        onBlur={(e) => {
          // Only save if focus leaves the editor entirely
          if (!e.currentTarget.contains(e.relatedTarget)) {
            save();
          }
        }}
      >
        <MarkdownEditor
          value={localValue}
          onChange={setLocalValue}
          placeholder="Add a description..."
          className="min-h-[120px]"
        />
      </div>
    );
  }

  return (
    <div
      className="hover:bg-accent/30 -mx-4 min-h-[60px] cursor-text rounded-md px-4 py-3 transition-colors"
      onClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") setIsEditing(true);
      }}
      role="button"
      tabIndex={0}
    >
      {value ? (
        <MarkdownContent className="prose-sm text-sm">{value}</MarkdownContent>
      ) : (
        <p className="text-muted-foreground/60 text-sm">Add a description...</p>
      )}
    </div>
  );
}
