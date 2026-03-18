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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openralph/ui/components/sidebar";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { StartLoopDialog } from "~/components/start-loop-dialog";
import { useLoops } from "~/hooks/use-collection";

type LoopItem = { id: string; name: string; status: string; currentIteration: number; maxIterations: number };

const statusColor: Record<string, string> = {
  running: "bg-green-500",
  queued: "bg-yellow-500",
  complete: "bg-muted-foreground",
  failed: "bg-destructive-foreground",
};

export function LoopNav() {
  const { data: loops, collection: loopCollection } = useLoops();
  const navigate = useNavigate();
  const params = useParams();
  const [startOpen, setStartOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LoopItem | null>(null);

  function handleDelete(id: string) {
    loopCollection.delete(id);
    setDeleteTarget(null);
    if (params.loopId === id) {
      navigate("/loops");
    }
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel className="font-mono text-[11px] uppercase tracking-wider">
          Loops
        </SidebarGroupLabel>
        <SidebarGroupAction onClick={() => setStartOpen(true)}>
          <PlusIcon className="size-4" />
        </SidebarGroupAction>
        <SidebarGroupContent>
          <SidebarMenu>
            {loops.slice(0, 10).map((l) => (
              <ContextMenu key={l.id}>
                <ContextMenuTrigger asChild>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild size="sm">
                      <Link to={`/loops/${l.id}`}>
                        <span
                          className={`size-2 shrink-0 rounded-full ${statusColor[l.status] ?? "bg-muted-foreground"}`}
                        />
                        <span className="truncate">{l.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuBadge className="font-mono text-[10px]">
                      {l.currentIteration}/{l.maxIterations}
                    </SidebarMenuBadge>
                  </SidebarMenuItem>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    className="text-destructive-foreground"
                    onSelect={() => setDeleteTarget(l)}
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

      <StartLoopDialog open={startOpen} onOpenChange={setStartOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete loop?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently deleted.
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
