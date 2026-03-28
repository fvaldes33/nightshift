import { Button } from "@openralph/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@openralph/ui/components/dropdown-menu";
import { Input } from "@openralph/ui/components/input";
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

const ALL_VALUE = "__all__";

type FilterOption = {
  value: string;
  label: ReactNode;
};

type SingleFilterGroup = {
  key: string;
  label: string;
  mode?: "single";
  value?: string;
  allLabel?: string;
  options: FilterOption[];
  onChange: (value: string | undefined) => void;
};

type MultiFilterGroup = {
  key: string;
  label: string;
  mode: "multi";
  value?: string; // comma-separated
  allLabel?: string;
  options: FilterOption[];
  onToggle: (value: string) => void;
  onClear: () => void;
};

type TextFilterGroup = {
  key: string;
  label: string;
  mode: "text";
  value?: string;
  placeholder?: string;
  onChange: (value: string | undefined) => void;
};

type FilterGroup = SingleFilterGroup | MultiFilterGroup | TextFilterGroup;

interface ListFilterMenuProps {
  groups: FilterGroup[];
  onClearAll?: () => void;
  className?: string;
}

function isActive(group: FilterGroup): boolean {
  return !!group.value;
}

export function ListFilterMenu({ groups, onClearAll, className }: ListFilterMenuProps) {
  const activeCount = groups.reduce((count, group) => count + (isActive(group) ? 1 : 0), 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <SlidersHorizontal className="size-3.5" />
          Filters
          {activeCount > 0 ? (
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] tabular-nums">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">Filters</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {groups.map((group) => (
          <DropdownMenuSub key={group.key}>
            <DropdownMenuSubTrigger className="text-xs">{group.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-56">
              {group.mode === "multi" ? (
                <MultiFilterContent group={group} />
              ) : group.mode === "text" ? (
                <TextFilterContent group={group} />
              ) : (
                <SingleFilterContent group={group} />
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
        {activeCount > 0 && onClearAll ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs"
              onSelect={(event) => {
                event.preventDefault();
                onClearAll();
              }}
            >
              Clear all filters
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SingleFilterContent({ group }: { group: SingleFilterGroup }) {
  return (
    <DropdownMenuRadioGroup
      value={group.value ?? ALL_VALUE}
      onValueChange={(next) => group.onChange(next === ALL_VALUE ? undefined : next)}
    >
      <DropdownMenuRadioItem value={ALL_VALUE} className="text-xs">
        {group.allLabel ?? "All"}
      </DropdownMenuRadioItem>
      {group.options.map((option) => (
        <DropdownMenuRadioItem key={option.value} value={option.value} className="text-xs">
          {option.label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

function MultiFilterContent({ group }: { group: MultiFilterGroup }) {
  const selected = group.value ? group.value.split(",") : [];
  return (
    <>
      {selected.length > 0 ? (
        <>
          <DropdownMenuItem
            className="text-muted-foreground text-xs"
            onSelect={(e) => {
              e.preventDefault();
              group.onClear();
            }}
          >
            {group.allLabel ?? "Clear selection"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </>
      ) : null}
      {group.options.map((option) => (
        <DropdownMenuCheckboxItem
          key={option.value}
          checked={selected.includes(option.value)}
          className="text-xs"
          onSelect={(e) => e.preventDefault()}
          onCheckedChange={() => group.onToggle(option.value)}
        >
          {option.label}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  );
}

function TextFilterContent({ group }: { group: TextFilterGroup }) {
  const [draft, setDraft] = useState(group.value ?? "");

  return (
    <div className="flex flex-col gap-1 p-2">
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            group.onChange(draft.trim() || undefined);
          }
          // Stop dropdown from interpreting typing as menu navigation
          e.stopPropagation();
        }}
        placeholder={group.placeholder ?? "Type and press Enter"}
        className="h-7 text-xs"
      />
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 flex-1 text-xs"
          onPointerDown={(e) => {
            e.preventDefault();
            setDraft("");
            group.onChange(undefined);
          }}
        >
          Clear
        </Button>
        <Button
          variant="default"
          size="sm"
          className="h-6 flex-1 text-xs"
          onPointerDown={(e) => {
            e.preventDefault();
            group.onChange(draft.trim() || undefined);
          }}
        >
          Apply
        </Button>
      </div>
    </div>
  );
}
