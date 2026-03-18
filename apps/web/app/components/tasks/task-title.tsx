import { useRef, useState } from "react";

interface TaskTitleProps {
  value: string;
  onUpdate: (fields: { title: string }) => void;
}

export function TaskTitle({ value, onUpdate }: TaskTitleProps) {
  const [localValue, setLocalValue] = useState(value);
  const originalRef = useRef(value);

  // Sync when server value changes (e.g. after revalidation)
  if (value !== originalRef.current) {
    originalRef.current = value;
    setLocalValue(value);
  }

  function save() {
    const trimmed = localValue.trim();
    if (trimmed && trimmed !== value) {
      onUpdate({ title: trimmed });
    } else {
      setLocalValue(value);
    }
  }

  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className="text-foreground w-full bg-transparent text-xl font-semibold outline-none placeholder:text-muted-foreground/50"
      placeholder="Task title"
    />
  );
}
