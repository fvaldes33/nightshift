import { useDisclosure } from "@mantine/hooks";
import { Button } from "@openralph/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openralph/ui/components/dialog";
import { Input } from "@openralph/ui/components/input";
import { Label } from "@openralph/ui/components/label";
import { Switch } from "@openralph/ui/components/switch";
import { Textarea } from "@openralph/ui/components/textarea";
import { GitPullRequestIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { trpc } from "~/lib/trpc-react";

interface CreatePRDialogProps {
  sessionId: string;
  sessionTitle: string;
  defaultBranch: string;
  trigger: React.ReactNode;
}

export function CreatePRDialog({
  sessionId,
  sessionTitle,
  defaultBranch,
  trigger,
}: CreatePRDialogProps) {
  const [title, setTitle] = useState(sessionTitle);
  const [body, setBody] = useState("");
  const [draft, setDraft] = useState(false);

  const generateSummary = trpc.session.generatePRSummary.useMutation({
    onSuccess: (data) => {
      setTitle(data.title);
      setBody(data.body);
    },
  });

  const createPR = trpc.session.createPR.useMutation({
    onSuccess: () => {
      close();
    },
  });

  const [opened, { open, close }] = useDisclosure(false, {
    onOpen: () => {
      setTitle(sessionTitle);
      setBody("");
      setDraft(false);
      generateSummary.mutate({ id: sessionId });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    createPR.mutate({
      id: sessionId,
      title: title.trim(),
      body,
      base: defaultBranch,
      draft,
    });
  }

  return (
    <>
      <span onClick={open}>{trigger}</span>
      <Dialog open={opened} onOpenChange={(v) => (v ? open() : close())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitPullRequestIcon className="size-4" />
              Create Pull Request
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pr-title">Title</Label>
              <div className="relative">
                <Input
                  id="pr-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="PR title"
                  autoFocus
                  disabled={generateSummary.isPending}
                />
                {generateSummary.isPending && (
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <SparklesIcon className="text-muted-foreground size-3.5 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pr-body">Description</Label>
              <div className="relative">
                <Textarea
                  id="pr-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={generateSummary.isPending ? "Generating..." : "Optional description..."}
                  rows={6}
                  disabled={generateSummary.isPending}
                />
                {generateSummary.isPending && (
                  <div className="absolute inset-y-0 right-2 top-2 flex items-start">
                    <SparklesIcon className="text-muted-foreground size-3.5 animate-pulse" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="pr-draft" className="text-sm">
                Draft PR
              </Label>
              <Switch id="pr-draft" checked={draft} onCheckedChange={setDraft} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!title.trim() || createPR.isPending || generateSummary.isPending}
              >
                {createPR.isPending ? (
                  <Loader2Icon className="size-3 animate-spin" />
                ) : (
                  <GitPullRequestIcon className="size-3" />
                )}
                Create PR
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
