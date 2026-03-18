import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openralph/ui/components/sidebar";
import { Link } from "react-router";
import { useLoops } from "~/hooks/use-collection";

type LoopItem = {
  id: string;
  name: string;
  status: string;
  currentIteration: number;
  maxIterations: number;
};

const statusColor: Record<string, string> = {
  running: "bg-green-500",
  queued: "bg-yellow-500",
  complete: "bg-muted-foreground",
  failed: "bg-destructive-foreground",
};

export function LoopNav() {
  const { data: loops } = useLoops();

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="font-mono text-[11px] uppercase tracking-wider">
        Loops
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {loops.slice(0, 10).map((l) => (
            <SidebarMenuItem key={l.id}>
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
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
