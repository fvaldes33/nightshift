import type { TaskListItem } from "@openralph/backend/types/task.types";
import { Checkbox } from "@openralph/ui/components/checkbox";
import {
  type ColumnDef,
  type RowSelectionState,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { useNavigate } from "react-router";
import { DataTable } from "~/components/data-table";
import { DataTableBulkActionToolbar } from "~/components/data-table-bulk-toolbar";
import { TaskBulkCmdk } from "~/components/task-bulk-cmdk";
import { taskColumns } from "~/components/task-columns";

const selectColumn: ColumnDef<TaskListItem> = {
  id: "select",
  header: ({ table }) => (
    <Checkbox
      checked={
        table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")
      }
      onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
      onClick={(e) => e.stopPropagation()}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(v) => row.toggleSelected(!!v)}
      onClick={(e) => e.stopPropagation()}
    />
  ),
  enableSorting: false,
};

const columns: ColumnDef<TaskListItem>[] = [selectColumn, ...taskColumns];

interface TaskTableProps {
  tasks: TaskListItem[];
  repoId?: string;
}

export function TaskTable({ tasks, repoId }: TaskTableProps) {
  const navigate = useNavigate();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const table = useReactTable({
    data: tasks,
    columns,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const taskUrl = (task: TaskListItem) => {
    const rid = repoId ?? task.repoId;
    return rid ? `/repos/${rid}/tasks/${task.id}` : `/repos`;
  };

  return (
    <>
      <DataTable table={table} onRowClick={(task) => navigate(taskUrl(task))} />
      <DataTableBulkActionToolbar table={table}>
        <TaskBulkCmdk table={table} />
      </DataTableBulkActionToolbar>
    </>
  );
}
