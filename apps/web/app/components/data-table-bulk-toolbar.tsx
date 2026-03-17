import { Button } from "@openralph/ui/components/button";
import { Separator } from "@openralph/ui/components/separator";
import { type Table } from "@tanstack/react-table";
import { X } from "lucide-react";

interface DataTableBulkActionToolbarProps<TData> {
  table: Table<TData>;
  children: React.ReactNode;
}

export function DataTableBulkActionToolbar<TData>({
  table,
  children,
}: DataTableBulkActionToolbarProps<TData>) {
  const selectedCount = table.getSelectedRowModel().rows.length;

  if (selectedCount === 0) return null;

  const isAllSelected = table.getIsAllRowsSelected();

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center">
      <div className="bg-background/80 animate-in slide-in-from-bottom-4 flex items-center gap-2 rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm">
        <span className="text-muted-foreground text-xs tabular-nums">{selectedCount} selected</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => table.toggleAllRowsSelected(false)}
        >
          <X className="size-3.5" />
          <span className="sr-only">Clear selection</span>
        </Button>

        <Separator orientation="vertical" className="h-5" />

        {children}

        {!isAllSelected && (
          <>
            <Separator orientation="vertical" className="h-5" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => table.toggleAllRowsSelected(true)}
            >
              Select All
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
