import { useDisclosure } from "@mantine/hooks";
import { Button } from "@openralph/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@openralph/ui/components/dialog";
import { toast } from "@openralph/ui/components/sonner";
import {
  CheckCircleIcon,
  DownloadIcon,
  FolderSearchIcon,
  InboxIcon,
  Loader2Icon,
} from "lucide-react";
import { createContext, useCallback, useContext } from "react";
import { trpc } from "~/lib/trpc-react";

export const ImportClaudeSessionContext = createContext<{
  repoId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({
  repoId: "",
  open: false,
  onOpenChange: () => {},
});

export function useImportClaudeSession() {
  const context = useContext(ImportClaudeSessionContext);
  if (!context) {
    throw new Error("useImportClaudeSession must be used within a ImportClaudeSessionProvider");
  }
  return context;
}

export function ImportClaudeSessions({
  repoId,
  children,
}: {
  repoId: string;
  children: React.ReactNode;
}) {
  const [isOpen, { open, close }] = useDisclosure(false);
  const onOpenChange = useCallback(
    (nextValue: boolean) => {
      if (nextValue) {
        open();
      } else {
        close();
      }
    },
    [open, close],
  );
  return (
    <ImportClaudeSessionContext.Provider value={{ repoId, open: isOpen, onOpenChange }}>
      {children}
    </ImportClaudeSessionContext.Provider>
  );
}

export function ImportClaudeSessionsDialogTrigger({ children }: { children: React.ReactNode }) {
  const { onOpenChange } = useImportClaudeSession();
  return (
    <Button variant="ghost" size="sm" className="h-7" onClick={() => onOpenChange(true)}>
      <DownloadIcon className="size-3.5" />
      {children}
    </Button>
  );
}

export function ImportClaudeSessionsDialog() {
  const { repoId, open, onOpenChange } = useImportClaudeSession();
  const discovery = trpc.session.discoverClaudeSessions.useQuery({ repoId }, { enabled: open });

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
            <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
            <span className="text-muted-foreground text-sm">Discovering sessions...</span>
          </div>
        ) : !data || data.total === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <InboxIcon className="text-muted-foreground size-8" />
            <p className="text-muted-foreground text-sm">
              No Claude Code sessions found for this project
            </p>
            <p className="text-muted-foreground/70 text-xs">
              Sessions are stored in ~/.claude/projects/
            </p>
          </div>
        ) : data.importable === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircleIcon className="size-8 text-green-500" />
            <p className="text-muted-foreground text-sm">
              All {data.total} sessions have already been imported
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="border-border/50 bg-muted/30 flex items-center gap-3 rounded-md border px-3 py-3">
              <FolderSearchIcon className="text-muted-foreground size-4 shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  Found {data.importable} Claude Code{" "}
                  {data.importable === 1 ? "session" : "sessions"} to import
                </span>
                {data.alreadyImported > 0 && (
                  <span className="text-muted-foreground text-xs">
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
              Import {data.importable} {data.importable === 1 ? "session" : "sessions"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
