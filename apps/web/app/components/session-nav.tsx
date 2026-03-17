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
import { MessageSquareIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useRevalidator } from "react-router";
import { trpc } from "~/lib/trpc-react";

type SessionItem = {
  id: string;
  title: string;
};

export function SessionNav({ sessions }: { sessions: SessionItem[] }) {
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const params = useParams();
  const [deleteTarget, setDeleteTarget] = useState<SessionItem | null>(null);
  const deleteSession = trpc.session.delete.useMutation({
    onSuccess: (_, variables) => {
      setDeleteTarget(null);
      if (params.sessionId === variables.id) {
        navigate("/");
      }
      revalidator.revalidate();
    },
  });

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="font-mono text-[11px] uppercase tracking-wider">
          Sessions
        </SidebarGroupLabel>
        <SidebarGroupAction asChild>
          <Link to="/sessions/new">
            <PlusIcon className="size-4" />
          </Link>
        </SidebarGroupAction>
        <SidebarGroupContent>
          <SidebarMenu>
            {sessions.slice(0, 10).map((s) => (
              <ContextMenu key={s.id}>
                <ContextMenuTrigger asChild>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild size="sm">
                      <Link to={`/sessions/${s.id}`}>
                        <MessageSquareIcon className="size-3.5" />
                        <span className="truncate">{s.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    className="text-destructive-foreground"
                    onSelect={() => setDeleteTarget(s)}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete session?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" and all its messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteSession.isPending}
              onClick={() => deleteTarget && deleteSession.mutate({ id: deleteTarget.id })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
