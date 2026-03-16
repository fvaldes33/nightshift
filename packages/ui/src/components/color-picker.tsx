import { HexColorPicker } from "react-colorful";

import { cn } from "@openralph/ui/lib/utils";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

function ColorPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (color: string) => void;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "border-input shadow-xs flex h-9 items-center gap-2 rounded-md border px-3 text-sm",
            className,
          )}
        >
          <span
            className="border-border size-4 shrink-0 rounded-sm border"
            style={{ backgroundColor: value }}
          />
          <span className="text-muted-foreground font-mono text-xs">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex flex-col gap-3">
          <HexColorPicker color={value} onChange={onChange} style={{ width: "100%" }} />
          <Input
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
            }}
            className="font-mono text-xs"
            maxLength={7}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { ColorPicker };
