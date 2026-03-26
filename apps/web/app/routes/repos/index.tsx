import type { RepoListItem } from "@openralph/backend/types/repo.types";
import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import { type ColumnDef, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { FolderGitIcon, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { AppHeader } from "~/components/app-header";
import { DataTable } from "~/components/data-table";
import { ImportRepoDialog } from "~/components/import-repo-dialog";
import { trpc } from "~/lib/trpc-react";

// ── Columns ───────────────────────────────────────────────────────────────────

const columns: ColumnDef<RepoListItem>[] = [
  {
    id: "fullName",
    header: "Repository",
    accessorFn: (row) => `${row.owner}/${row.name}`,
    cell: ({ row }) => (
      <span className="font-medium">
        {row.original.owner}/{row.original.name}
      </span>
    ),
  },
  {
    accessorKey: "defaultBranch",
    header: "Default Branch",
    cell: ({ getValue }) => (
      <Badge variant="secondary" className="font-mono text-[10px]">
        {getValue<string>()}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Added",
    cell: ({ getValue }) => (
      <span className="text-muted-foreground text-xs">
        {new Date(getValue<string>()).toLocaleDateString()}
      </span>
    ),
  },
];

export function meta() {
  return [{ title: "Repos — nightshift" }];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function Repos() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: repos = [] } = trpc.repo.list.useQuery({});

  const table = useReactTable({
    data: repos,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const isEmpty = repos.length === 0;

  if (isEmpty) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24">
          <FolderGitIcon className="text-muted-foreground mb-4 size-12" />
          <h3 className="text-lg font-semibold">No repos connected</h3>
          <p className="text-muted-foreground mb-4 mt-1 text-sm">
            Import a GitHub repo to get started.
          </p>
          <Button size="sm" className="h-8" onClick={() => setDialogOpen(true)}>
            <Plus className="size-3.5" />
            Import repo
          </Button>
        </div>
        <ImportRepoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <AppHeader
          actions={
            <Button size="sm" className="h-7" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" />
              Import
            </Button>
          }
        >
          <h1 className="text-sm font-semibold">Repos</h1>
          <span className="text-muted-foreground text-xs tabular-nums">{repos.length}</span>
        </AppHeader>

        <DataTable table={table} onRowClick={(row) => navigate(`/repos/${row.id}`)} />
      </div>

      <ImportRepoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
