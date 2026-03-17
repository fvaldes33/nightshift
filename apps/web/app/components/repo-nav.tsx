import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openralph/ui/components/sidebar";
import { FolderGitIcon } from "lucide-react";
import { Link } from "react-router";

type RepoItem = {
  id: string;
  owner: string;
  name: string;
};

export function RepoNav({ repos }: { repos: RepoItem[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="font-mono text-[11px] uppercase tracking-wider">
        Repos
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {repos.map((r) => (
            <SidebarMenuItem key={r.id}>
              <SidebarMenuButton asChild size="sm">
                <Link to={`/repos/${r.id}`}>
                  <FolderGitIcon className="size-3.5" />
                  <span className="truncate">
                    {r.owner}/{r.name}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
