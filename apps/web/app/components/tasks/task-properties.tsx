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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openralph/ui/components/tooltip";
import {
  AlertCircleIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CircleDotIcon,
  FolderGit2Icon,
  MinusIcon,
  SignalIcon,
  TagIcon,
  UserIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { statusConfig, priorityConfig } from "~/components/task-columns";
import { TaskPropertyRow } from "./task-property-row";

const STATUSES = ["backlog", "todo", "in_progress", "done", "canceled"] as const;
const PRIORITIES = [1, 2, 3, 4] as const;

const priorityIcon: Record<number, React.ReactNode> = {
  1: <AlertCircleIcon className="size-3.5 text-orange-500" />,
  2: <ChevronUpIcon className="size-3.5 text-orange-400" />,
  3: <MinusIcon className="size-3.5 text-yellow-500" />,
  4: <ChevronDownIcon className="size-3.5 text-blue-400" />,
};

interface TaskPropertiesProps {
  task: TaskGetOutput;
  onUpdate: (fields: Partial<TaskUpdateInput>) => void;
}

export function TaskProperties({ task, onUpdate }: TaskPropertiesProps) {
  return (
    <div className="space-y-1 px-2 py-4">
      <StatusProperty value={task.status} onUpdate={onUpdate} />
      <PriorityProperty value={task.priority} onUpdate={onUpdate} />
      <AssigneeProperty value={task.assignee} onUpdate={onUpdate} />
      <LabelsProperty value={task.labels} onUpdate={onUpdate} />

      {task.repo && (
        <TaskPropertyRow icon={<FolderGit2Icon />} label="Repo">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to={`/repos/${task.repo.id}`}
                className="text-foreground hover:underline block max-w-[120px] truncate text-xs"
              >
                {task.repo.owner}/{task.repo.name}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {task.repo.owner}/{task.repo.name}
            </TooltipContent>
          </Tooltip>
        </TaskPropertyRow>
      )}

      <TaskPropertyRow icon={<CalendarIcon />} label="Created">
        <span className="text-muted-foreground text-xs">
          {new Date(task.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </TaskPropertyRow>
    </div>
  );
}

// ── Status ─────────────────────────────────────────────────────────────────────

function StatusProperty({
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
        <button type="button" className="w-full text-left">
          <TaskPropertyRow icon={<CircleDotIcon />} label="Status">
            <span className="flex items-center gap-2">
              <span className={`size-2 shrink-0 rounded-full ${config.dot}`} />
              <span className="text-xs">{config.label}</span>
            </span>
          </TaskPropertyRow>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" side="bottom" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {STATUSES.map((s) => {
                const sc = statusConfig[s];
                return (
                  <CommandItem
                    key={s}
                    value={s}
                    onSelect={() => {
                      onUpdate({ status: s });
                      setOpen(false);
                    }}
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

// ── Priority ───────────────────────────────────────────────────────────────────

function PriorityProperty({
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
        <button type="button" className="w-full text-left">
          <TaskPropertyRow icon={<SignalIcon />} label="Priority">
            <span className="flex items-center gap-2">
              {priorityIcon[value]}
              <span className="text-xs">{priorityConfig[value] ?? value}</span>
            </span>
          </TaskPropertyRow>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" side="bottom" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {PRIORITIES.map((p) => (
                <CommandItem
                  key={p}
                  value={String(p)}
                  onSelect={() => {
                    onUpdate({ priority: p });
                    setOpen(false);
                  }}
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

// ── Assignee ───────────────────────────────────────────────────────────────────

function AssigneeProperty({
  value,
  onUpdate,
}: {
  value: string | null;
  onUpdate: (f: Partial<TaskUpdateInput>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? "");

  function save() {
    const trimmed = inputValue.trim();
    onUpdate({ assignee: trimmed || null });
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setInputValue(value ?? "");
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="w-full text-left">
          <TaskPropertyRow icon={<UserIcon />} label="Assignee">
            <span className={`text-xs ${value ? "" : "text-muted-foreground"}`}>
              {value || "No assignee"}
            </span>
          </TaskPropertyRow>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" side="bottom" align="start">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setOpen(false);
          }}
          onBlur={save}
          placeholder="Assignee name"
          className="h-8 text-xs"
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ── Labels ─────────────────────────────────────────────────────────────────────

function LabelsProperty({
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

  function removeLabel(label: string) {
    onUpdate({ labels: value.filter((l) => l !== label) });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="w-full text-left">
          <TaskPropertyRow icon={<TagIcon />} label="Labels">
            {value.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {value.map((label) => (
                  <Badge key={label} variant="secondary" className="text-[10px]">
                    {label}
                  </Badge>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">None</span>
            )}
          </TaskPropertyRow>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-2" side="bottom" align="start">
        <div className="space-y-2">
          {value.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {value.map((label) => (
                <Badge
                  key={label}
                  variant="secondary"
                  className="gap-1 text-[10px]"
                >
                  {label}
                  <button
                    type="button"
                    className="hover:text-foreground ml-0.5 text-muted-foreground"
                    onClick={() => removeLabel(label)}
                  >
                    &times;
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addLabel();
                }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Add label"
              className="h-7 text-xs"
              autoFocus
            />
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onClick={addLabel}
              disabled={!inputValue.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
