import type { RepoListItem } from "@openralph/backend/types/repo.types";
import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@openralph/ui/components/dialog";
import { Input } from "@openralph/ui/components/input";
import { type ColumnDef, getCoreRowModel, getSortedRowModel, useReactTable } from "@tanstack/react-table";
import { useDebouncedCallback } from "@mantine/hooks";
import { CheckIcon, FolderGitIcon, Loader2Icon, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { DataTable } from "~/components/data-table";
import { useRepos } from "~/hooks/use-collection";
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

  const { data: repos } = useRepos();

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
        <ImportRepoDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSuccess={() => {}}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b p-4">
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
              {repos.length} repos
            </span>
            <Button size="sm" className="h-8" onClick={() => setDialogOpen(true)}>
              <Plus className="size-3.5" />
              Import repo
            </Button>
          </div>
        </div>

        <DataTable table={table} onRowClick={(row) => navigate(`/repos/${row.id}`)} />
      </div>

      <ImportRepoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {}}
      />
    </>
  );
}

// ── Import Repo Dialog ──────────────────────────────────────────────────────

function ImportRepoDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [search, setSearch] = useState("");

  const { data: githubRepos, isLoading } = trpc.repo.listGitHub.useQuery(
    {},
    { enabled: open },
  );

  const { data: existingRepos } = trpc.repo.list.useQuery({});
  const existingNames = new Set((existingRepos ?? []).map((r) => `${r.owner}/${r.name}`));

  const createRepo = trpc.repo.create.useMutation({
    onSuccess: () => onSuccess(),
  });

  const filtered = (githubRepos ?? []).filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import from GitHub</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <div className="max-h-72 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No repos found.</p>
          ) : (
            <div className="grid gap-0.5">
              {filtered.map((repo) => {
                const alreadyAdded = existingNames.has(repo.fullName);
                return (
                  <button
                    key={repo.githubId}
                    type="button"
                    disabled={alreadyAdded || createRepo.isPending}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent/50 disabled:opacity-50"
                    onClick={() =>
                      createRepo.mutate({
                        owner: repo.owner,
                        name: repo.name,
                        defaultBranch: repo.defaultBranch,
                        cloneUrl: repo.cloneUrl ?? undefined,
                      })
                    }
                  >
                    <FolderGitIcon className="text-muted-foreground size-4 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{repo.fullName}</span>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {repo.defaultBranch}
                      </span>
                    </div>
                    {repo.private && (
                      <Badge variant="outline" className="text-[10px]">
                        private
                      </Badge>
                    )}
                    {alreadyAdded && <CheckIcon className="size-4 text-green-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
