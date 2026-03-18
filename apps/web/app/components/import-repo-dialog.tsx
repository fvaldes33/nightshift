import type { RepoListItem } from "@openralph/backend/types/repo.types";
import { Badge } from "@openralph/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@openralph/ui/components/dialog";
import { Input } from "@openralph/ui/components/input";
import { CheckIcon, FolderGitIcon, Loader2Icon, Search } from "lucide-react";
import { useState } from "react";
import { useRepos } from "~/hooks/use-collection";
import { trpc } from "~/lib/trpc-react";

export function ImportRepoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: existingRepos } = useRepos();
  const existingNames = new Set(existingRepos.map((r) => `${r.owner}/${r.name}`));

  const { data: githubRepos, isLoading } = trpc.repo.listGitHub.useQuery(
    {},
    { enabled: open },
  );

  const createRepo = trpc.repo.create.useMutation({
    onSuccess: () => onOpenChange(false),
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
