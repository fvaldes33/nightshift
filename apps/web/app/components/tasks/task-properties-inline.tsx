import type { TaskGetOutput, TaskUpdateInput } from "@openralph/backend/types/task.types";
import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@openralph/ui/components/command";
import { Input } from "@openralph/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openralph/ui/components/popover";
import {
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
  TagIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";
import { statusConfig, priorityConfig } from "~/components/task-columns";

const STATUSES = ["backlog", "todo", "in_progress", "done", "canceled"] as const;
const PRIORITIES = [1, 2, 3, 4] as const;

const priorityIcon: Record<number, React.ReactNode> = {
  1: <AlertCircleIcon className="size-3 text-orange-500" />,
  2: <ChevronUpIcon className="size-3 text-orange-400" />,
  3: <MinusIcon className="size-3 text-yellow-500" />,
  4: <ChevronDownIcon className="size-3 text-blue-400" />,
};

interface TaskPropertiesInlineProps {
  task: TaskGetOutput;
  onUpdate: (fields: Partial<TaskUpdateInput>) => void;
}

export function TaskPropertiesInline({ task, onUpdate }: TaskPropertiesInlineProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusPill value={task.status} onUpdate={onUpdate} />
      <PriorityPill value={task.priority} onUpdate={onUpdate} />
      <AssigneePill value={task.assignee} onUpdate={onUpdate} />
      <LabelsPills value={task.labels} onUpdate={onUpdate} />
    </div>
  );
}

function StatusPill({
  value,
  onUpdate,
}: {
  value: string;
  onUpdate: (f: Partial<TaskUpdateInput>) => void;
}) {
  const [open, setOpen] = useState(false);
  const config = statusConfig[value] ?? statusConfig.backlog;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button">
          <Badge variant="secondary" className="gap-1.5 text-[11px]">
            <span className={`size-1.5 shrink-0 rounded-full ${config.dot}`} />
            {config.label}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {STATUSES.map((s) => {
                const sc = statusConfig[s];
                return (
                  <CommandItem
                    key={s}
                    value={s}
                    onSelect={() => { onUpdate({ status: s }); setOpen(false); }}
                  >
                    <span className={`size-2 shrink-0 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PriorityPill({
  value,
  onUpdate,
}: {
  value: number;
  onUpdate: (f: Partial<TaskUpdateInput>) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button">
          <Badge variant="secondary" className="gap-1 text-[11px]">
            {priorityIcon[value]}
            {priorityConfig[value] ?? value}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {PRIORITIES.map((p) => (
                <CommandItem
                  key={p}
                  value={String(p)}
                  onSelect={() => { onUpdate({ priority: p }); setOpen(false); }}
                >
                  {priorityIcon[p]}
                  {priorityConfig[p]}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AssigneePill({
  value,
  onUpdate,
}: {
  value: string | null;
  onUpdate: (f: Partial<TaskUpdateInput>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? "");

  function save() {
    onUpdate({ assignee: inputValue.trim() || null });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setInputValue(value ?? ""); }}>
      <PopoverTrigger asChild>
        <button type="button">
          <Badge variant={value ? "secondary" : "outline"} className="gap-1 text-[11px]">
            <UserIcon className="size-2.5" />
            {value || "Assignee"}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-2" align="start">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }}
          onBlur={save}
          placeholder="Assignee name"
          className="h-7 text-xs"
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function LabelsPills({
  value,
  onUpdate,
}: {
  value: string[];
  onUpdate: (f: Partial<TaskUpdateInput>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  function addLabel() {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onUpdate({ labels: [...value, trimmed] });
    }
    setInputValue("");
  }

  return (
    <>
      {value.map((label) => (
        <Badge key={label} variant="secondary" className="gap-1 text-[11px]">
          <TagIcon className="size-2.5" />
          {label}
          <button
            type="button"
            className="ml-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => onUpdate({ labels: value.filter((l) => l !== label) })}
          >
            &times;
          </button>
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button">
            <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground">
              <TagIcon className="size-2.5" />
              Label
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[180px] p-2" align="start">
          <div className="flex gap-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLabel(); } if (e.key === "Escape") setOpen(false); }}
              placeholder="Add label"
              className="h-7 text-xs"
              autoFocus
            />
            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={addLabel} disabled={!inputValue.trim()}>
              Add
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
