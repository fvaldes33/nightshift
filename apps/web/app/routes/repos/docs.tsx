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
import { Button } from "@openralph/ui/components/button";
import { FileTextIcon, Loader2, NotebookTextIcon, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useDocs } from "~/hooks/use-collection";
import { trpc } from "~/lib/trpc-react";

export function meta() {
  return [{ title: "Docs — nightshift" }];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function RepoDocs() {
  const params = useParams();
  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: repo, isLoading } = trpc.repo.get.useQuery({ id: params.repoId! });
  const { data: docs, collection: docCollection } = useDocs({ repoId: params.repoId });

  const createDoc = trpc.doc.create.useMutation({
    onSuccess: (doc) => {
      navigate(`/docs/${doc.id}`);
    },
  });

  function handleDeleteDoc(id: string) {
    docCollection.delete(id);
    setDeleteId(null);
  }

  function handleCreate() {
    createDoc.mutate({
      repoId: params.repoId,
      title: "Untitled Document",
      content: "",
    });
  }

  if (isLoading || !repo) return null;

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/repos/${repo.id}`}>
                {repo.owner}/{repo.name}
              </Link>
            </Button>
            <span className="text-muted-foreground text-sm">/</span>
            <h3 className="text-sm font-medium">Docs</h3>
          </div>
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

        {docs.length > 0 ? (
          <div className="divide-border divide-y">
            {docs.map((doc: DocListItem) => (
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
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <NotebookTextIcon className="text-muted-foreground/40 mx-auto mb-3 size-10" />
            <p className="text-muted-foreground mb-1 text-sm">No docs yet</p>
            <p className="text-muted-foreground mb-4 text-xs">
              Add repo-specific context for Ralph — commands, structure, conventions.
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
                onClick={() => deleteId && handleDeleteDoc(deleteId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
