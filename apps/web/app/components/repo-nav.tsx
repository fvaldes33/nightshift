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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@openralph/ui/components/context-menu";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openralph/ui/components/sidebar";
import { FolderGitIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ImportRepoDialog } from "~/components/import-repo-dialog";
import { useRepos } from "~/hooks/use-collection";

type RepoItem = { id: string; owner: string; name: string };

export function RepoNav() {
  const { data: repos, collection: repoCollection } = useRepos();
  const navigate = useNavigate();
  const params = useParams();
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RepoItem | null>(null);

  function handleDelete(id: string) {
    repoCollection.delete(id);
    setDeleteTarget(null);
    if (params.repoId === id) {
      navigate("/repos");
    }
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="font-mono text-[11px] uppercase tracking-wider">
          Repos
        </SidebarGroupLabel>
        <SidebarGroupAction onClick={() => setImportOpen(true)}>
          <PlusIcon className="size-4" />
        </SidebarGroupAction>
        <SidebarGroupContent>
          <SidebarMenu>
            {repos.map((r) => (
              <ContextMenu key={r.id}>
                <ContextMenuTrigger asChild>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild size="sm">
                      <Link to={`/repos/${r.id}`}>
                        <FolderGitIcon className="size-3.5" />
                        <span className="truncate">
                          {r.owner}/{r.name}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    className="text-destructive-foreground"
                    onSelect={() => setDeleteTarget(r)}
                  >
                    <TrashIcon className="size-3.5" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <ImportRepoDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete repo?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.owner}/{deleteTarget?.name}" and all associated data will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
