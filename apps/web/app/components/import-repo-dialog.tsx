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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@openralph/ui/components/tabs";
import {
  CheckCircleIcon,
  CheckIcon,
  FolderGitIcon,
  FolderOpenIcon,
  GithubIcon,
  Loader2Icon,
  Search,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "~/lib/trpc-react";

export function ImportRepoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Workspace</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="github">
          <TabsList className="w-full">
            <TabsTrigger value="github" className="flex-1 gap-1.5">
              <GithubIcon className="size-3.5" />
              GitHub
            </TabsTrigger>
            <TabsTrigger value="local" className="flex-1 gap-1.5">
              <FolderOpenIcon className="size-3.5" />
              Local Path
            </TabsTrigger>
          </TabsList>
          <TabsContent value="github" className="mt-3">
            <GitHubTab onDone={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="local" className="mt-3">
            <LocalTab onDone={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── GitHub Tab ────────────────────────────────────────────────────────────────

function GitHubTab({ onDone }: { onDone: () => void }) {
  const [search, setSearch] = useState("");
  const { data: existingRepos = [] } = trpc.repo.list.useQuery({});
  const existingNames = new Set(existingRepos.map((r) => `${r.owner}/${r.name}`));

  const { data: githubRepos, isLoading } = trpc.repo.listGitHub.useQuery({});

  const createRepo = trpc.repo.create.useMutation({ onSuccess: onDone });

  const filtered = (githubRepos ?? []).filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>
      <div className="mt-3 max-h-72 overflow-auto">
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
    </>
  );
}

// ── Local Tab ─────────────────────────────────────────────────────────────────

function LocalTab({ onDone }: { onDone: () => void }) {
  const [path, setPath] = useState("");

  const resolved = trpc.repo.resolveLocal.useQuery(
    { path: path.trim() },
    { enabled: path.trim().length > 0, retry: false },
  );

  const linkLocal = trpc.repo.linkLocal.useMutation({ onSuccess: onDone });

  const info = resolved.data;
  const error = resolved.error?.message;
  const isValidating = resolved.isFetching;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Input
          placeholder="/Users/you/projects/my-repo"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="font-mono text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && info && !linkLocal.isPending) {
              linkLocal.mutate({ path: path.trim() });
            }
          }}
        />
        <p className="text-muted-foreground mt-1.5 text-xs">
          Absolute path to an existing git repository on this machine.
        </p>
      </div>

      {/* Validation feedback */}
      {isValidating && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2Icon className="size-3.5 animate-spin" />
          Checking...
        </div>
      )}

      {error && !isValidating && (
        <div className="text-destructive-foreground flex items-center gap-2 text-sm">
          <XCircleIcon className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {info && !isValidating && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5">
            <CheckCircleIcon className="size-4 text-green-500 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">
                {info.owner}/{info.name}
              </span>
              <span className="text-muted-foreground font-mono text-[10px]">
                {info.defaultBranch} · {info.path}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => linkLocal.mutate({ path: path.trim() })}
            disabled={linkLocal.isPending}
            className="gap-1.5"
          >
            {linkLocal.isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <FolderOpenIcon className="size-3.5" />
            )}
            Link Workspace
          </Button>
        </div>
      )}
    </div>
  );
}
