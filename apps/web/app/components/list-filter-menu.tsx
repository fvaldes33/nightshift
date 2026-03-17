import { Button } from "@openralph/ui/components/button";
import {
  DropdownMenu,
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
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";

const ALL_VALUE = "__all__";

type FilterOption = {
  value: string;
  label: ReactNode;
};

type FilterGroup = {
  key: string;
  label: string;
  value?: string;
  allLabel?: string;
  options: FilterOption[];
  onChange: (value: string | undefined) => void;
};

interface ListFilterMenuProps {
  groups: FilterGroup[];
  onClearAll?: () => void;
  className?: string;
}

export function ListFilterMenu({ groups, onClearAll, className }: ListFilterMenuProps) {
  const activeCount = groups.reduce((count, group) => count + (group.value ? 1 : 0), 0);

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
              <DropdownMenuRadioGroup
                value={group.value ?? ALL_VALUE}
                onValueChange={(next) => group.onChange(next === ALL_VALUE ? undefined : next)}
              >
                <DropdownMenuRadioItem value={ALL_VALUE} className="text-xs">
                  {group.allLabel ?? "All"}
                </DropdownMenuRadioItem>
                {group.options.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    className="text-xs"
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
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
