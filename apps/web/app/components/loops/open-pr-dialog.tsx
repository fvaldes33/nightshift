import type { LoopGetOutput } from "@openralph/backend/types/loop.types";
import { Button } from "@openralph/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openralph/ui/components/dialog";
import { Input } from "@openralph/ui/components/input";
import { Label } from "@openralph/ui/components/label";
import { Textarea } from "@openralph/ui/components/textarea";
import { LoaderIcon, SparklesIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "~/lib/trpc-react";

interface OpenPRDialogProps {
  loop: LoopGetOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenPRDialog({ loop, open, onOpenChange }: OpenPRDialogProps) {
  const [title, setTitle] = useState(loop.name);
  const [body, setBody] = useState("");
  const [base, setBase] = useState("main");
  const utils = trpc.useUtils();

  const generateSummary = trpc.loop.generatePRSummary.useMutation({
    onSuccess: (data) => {
      setTitle(data.title);
      setBody(data.body);
    },
  });

  const openPR = trpc.loop.openPR.useMutation({
    onSuccess: () => {
      utils.loop.get.invalidate({ id: loop.id });
      onOpenChange(false);
    },
  });

  // Auto-generate summary when dialog opens
  useEffect(() => {
    if (open && !body) {
      generateSummary.mutate({ id: loop.id });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    openPR.mutate({ id: loop.id, title, body, base });
  }

  const isLoading = generateSummary.isPending || openPR.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open Pull Request</DialogTitle>
          <DialogDescription>
            Create a PR for the <span className="font-mono">{loop.branch}</span> branch.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pr-title">Title</Label>
            {generateSummary.isPending ? (
              <div className="flex h-9 items-center gap-2 rounded-md border px-3">
                <LoaderIcon className="size-3.5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Generating...</span>
              </div>
            ) : (
              <Input
                id="pr-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="PR title"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pr-body">Description</Label>
            {generateSummary.isPending ? (
              <div className="flex h-24 items-center justify-center rounded-md border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <SparklesIcon className="size-3.5" />
                  <span className="text-sm">Generating summary from loop events...</span>
                </div>
              </div>
            ) : (
              <Textarea
                id="pr-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="PR description"
                rows={8}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pr-base">Base branch</Label>
            <Input
              id="pr-base"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="main"
            />
          </div>

          {(generateSummary.isError || openPR.isError) && (
            <p className="text-sm text-destructive">
              {generateSummary.error?.message || openPR.error?.message}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !title}>
              {openPR.isPending ? (
                <>
                  <LoaderIcon className="size-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create PR"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
