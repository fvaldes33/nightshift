import { Button } from "@openralph/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@openralph/ui/components/dialog";
import { toast } from "@openralph/ui/components/sonner";
import {
  CheckCircleIcon,
  DownloadIcon,
  FolderSearchIcon,
  InboxIcon,
  Loader2Icon,
} from "lucide-react";
import { trpc } from "~/lib/trpc-react";

export function ImportClaudeSessionsDialog({
  repoId,
  open,
  onOpenChange,
}: {
  repoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const discovery = trpc.session.discoverClaudeSessions.useQuery(
    { repoId },
    { enabled: open },
  );

  const importMutation = trpc.session.importClaudeSessions.useMutation({
    onSuccess: (data) => {
      toast(`Importing ${data.count} sessions...`);
      onOpenChange(false);
    },
  });

  const data = discovery.data;
  const isLoading = discovery.isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Claude Code Sessions</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Discovering sessions...
            </span>
          </div>
        ) : !data || data.total === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <InboxIcon className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No Claude Code sessions found for this project
            </p>
            <p className="text-xs text-muted-foreground/70">
              Sessions are stored in ~/.claude/projects/
            </p>
          </div>
        ) : data.importable === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircleIcon className="size-8 text-green-500" />
            <p className="text-sm text-muted-foreground">
              All {data.total} sessions have already been imported
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-3">
              <FolderSearchIcon className="size-4 text-muted-foreground shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  Found {data.importable} Claude Code{" "}
                  {data.importable === 1 ? "session" : "sessions"} to import
                </span>
                {data.alreadyImported > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {data.alreadyImported} already imported
                  </span>
                )}
              </div>
            </div>
            <Button
              onClick={() => importMutation.mutate({ repoId })}
              disabled={importMutation.isPending}
              className="gap-1.5"
            >
              {importMutation.isPending ? (
                <Loader2Icon className="size-3.5 animate-spin" />
              ) : (
                <DownloadIcon className="size-3.5" />
              )}
              Import {data.importable}{" "}
              {data.importable === 1 ? "session" : "sessions"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
