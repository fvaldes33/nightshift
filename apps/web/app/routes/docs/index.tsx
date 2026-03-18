import { createCaller } from "@openralph/backend/lib/caller";
import type { DocListItem } from "@openralph/backend/types/doc.types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openralph/ui/components/alert-dialog";
import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openralph/ui/components/select";
import { FileTextIcon, Loader2, NotebookTextIcon, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { trpc } from "~/lib/trpc-react";
import type { Route } from "./+types/index";

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const caller = createCaller(request);
  const [docs, repos] = await Promise.all([caller.doc.list({}), caller.repo.list({})]);
  return { docs, repos };
}

export function meta() {
  return [{ title: "Docs — nightshift" }];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DocsIndex() {
  const { docs: initialDocs, repos } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [repoFilter, setRepoFilter] = useState<string>("all");

  const { data } = trpc.doc.list.useQuery({}, { initialData: initialDocs });
  const allDocs = data ?? initialDocs;

  const docs =
    repoFilter === "all"
      ? allDocs
      : repoFilter === "global"
        ? allDocs.filter((d: DocListItem) => !d.repoId)
        : allDocs.filter((d: DocListItem) => d.repoId === repoFilter);

  const repoMap = new Map(repos.map((r) => [r.id, r]));

  const utils = trpc.useUtils();

  const createDoc = trpc.doc.create.useMutation({
    onSuccess: (doc) => {
      utils.doc.list.invalidate();
      navigate(`/docs/${doc.id}`);
    },
  });

  const deleteDoc = trpc.doc.delete.useMutation({
    onSuccess: () => {
      utils.doc.list.invalidate();
      setDeleteId(null);
    },
  });

  function handleCreate() {
    createDoc.mutate({
      repoId: repoFilter !== "all" && repoFilter !== "global" ? repoFilter : undefined,
      title: "Untitled Document",
      content: "",
    });
  }

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-sm font-medium">Docs</h3>
          <div className="flex items-center gap-2">
            <Select value={repoFilter} onValueChange={setRepoFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="All docs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All docs</SelectItem>
                <SelectItem value="global">Global (no repo)</SelectItem>
                {repos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.owner}/{r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8"
              onClick={handleCreate}
              disabled={createDoc.isPending}
            >
              {createDoc.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              New
            </Button>
          </div>
        </div>

        {docs.length > 0 ? (
          <div className="divide-border divide-y">
            {docs.map((doc: DocListItem) => {
              const repo = doc.repoId ? repoMap.get(doc.repoId) : null;
              return (
                <div
                  key={doc.id}
                  className="hover:bg-muted/50 -mx-1 flex cursor-pointer items-center gap-4 rounded-md py-3 pl-1 pr-1 transition-colors"
                  onClick={() => navigate(`/docs/${doc.id}`)}
                >
                  <FileTextIcon className="text-muted-foreground size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.title}</p>
                    <p className="text-muted-foreground text-xs">
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {repo ? (
                    <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                      {repo.owner}/{repo.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      global
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(doc.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <NotebookTextIcon className="text-muted-foreground/40 mx-auto mb-3 size-10" />
            <p className="text-muted-foreground mb-1 text-sm">No docs yet</p>
            <p className="text-muted-foreground mb-4 text-xs">
              Create context docs for Ralph — repo conventions, global prompts, or reference
              material.
            </p>
            <Button
              size="sm"
              className="h-8"
              onClick={handleCreate}
              disabled={createDoc.isPending}
            >
              {createDoc.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              New Document
            </Button>
          </div>
        )}

        <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete document?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this document. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteDoc.mutate({ id: deleteId })}
                disabled={deleteDoc.isPending}
              >
                {deleteDoc.isPending ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
