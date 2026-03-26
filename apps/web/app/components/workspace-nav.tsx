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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openralph/ui/components/collapsible";
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
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@openralph/ui/components/sidebar";
import {
  ChevronRightIcon,
  FolderGitIcon,
  ListTodoIcon,
  MessageSquareIcon,
  PlusIcon,
  RepeatIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router";
import { ImportRepoDialog } from "~/components/import-repo-dialog";
import { trpc } from "~/lib/trpc-react";

type RepoItem = { id: string; owner: string; name: string };

export function WorkspaceNav() {
  const { data: repos = [] } = trpc.repo.list.useQuery({});
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const params = useParams();
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RepoItem | null>(null);

  const deleteRepo = trpc.repo.delete.useMutation({
    onSuccess: () => utils.repo.list.invalidate(),
  });

  function handleDelete(id: string) {
    deleteRepo.mutate({ id });
    setDeleteTarget(null);
    if (params.repoId === id) {
      navigate("/repos");
    }
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="font-mono text-[11px] uppercase tracking-wider">
          Workspaces
        </SidebarGroupLabel>
        <SidebarGroupAction onClick={() => setImportOpen(true)}>
          <PlusIcon className="size-4" />
        </SidebarGroupAction>
        <SidebarGroupContent>
          <SidebarMenu>
            {repos.map((repo) => (
              <WorkspaceItem
                key={repo.id}
                repo={repo}
                onDeleteRequest={() => setDeleteTarget(repo)}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <ImportRepoDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
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

function WorkspaceItem({
  repo,
  onDeleteRequest,
}: {
  repo: RepoItem;
  onDeleteRequest: () => void;
}) {
  const { data: sessions = [] } = trpc.session.list.useQuery({ repoId: repo.id });
  const { data: tasks = [] } = trpc.task.list.useQuery({ repoId: repo.id });
  const { data: loops = [] } = trpc.loop.list.useQuery({ repoId: repo.id });

  const runningLoops = loops.filter((l) => l.status === "running" || l.status === "queued");
  const prefix = `/repos/${repo.id}`;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarMenuItem>
            {/* Repo name — navigation only */}
            <SidebarMenuButton asChild size="sm">
              <NavLink to={prefix} end>
                <FolderGitIcon className="size-3.5" />
                <span className="truncate">
                  {repo.owner}/{repo.name}
                </span>
              </NavLink>
            </SidebarMenuButton>

            {/* Caret — toggle only */}
            <CollapsibleTrigger asChild>
              <SidebarMenuAction>
                <ChevronRightIcon className="size-3.5 transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuAction>
            </CollapsibleTrigger>

            {runningLoops.length > 0 && (
              <SidebarMenuBadge className="bg-green-500/15 text-green-500 text-[10px]">
                {runningLoops.length}
              </SidebarMenuBadge>
            )}

            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild size="sm">
                    <NavLink to={`${prefix}/tasks`}>
                      <ListTodoIcon className="size-3" />
                      <span>Tasks</span>
                      {tasks.length > 0 && (
                        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                          {tasks.length}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild size="sm">
                    <NavLink to={`${prefix}/sessions`}>
                      <MessageSquareIcon className="size-3" />
                      <span>Sessions</span>
                      {sessions.length > 0 && (
                        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                          {sessions.length}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild size="sm">
                    <NavLink to={`${prefix}/loops`}>
                      <RepeatIcon className="size-3" />
                      <span>Loops</span>
                      {loops.length > 0 && (
                        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                          {loops.length}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          className="text-destructive-foreground"
          onSelect={onDeleteRequest}
        >
          <TrashIcon className="size-3.5" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
