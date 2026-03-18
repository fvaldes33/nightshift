import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@openralph/ui/components/sidebar";
import { ListTodoIcon, NotebookTextIcon } from "lucide-react";
import { Link, Outlet, redirect } from "react-router";
import { LoopNav } from "~/components/loop-nav";
import { RepoNav } from "~/components/repo-nav";
import { SessionNav } from "~/components/session-nav";
import { UserFooter } from "~/components/user-footer";
import { getSession } from "~/lib/auth-client";
import type { Route } from "./+types/app-layout";

export async function clientLoader() {
  const session = await getSession();
  if (!session?.data?.user) throw redirect("/login");
  return { user: session.data.user };
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <SidebarProvider className="max-h-svh">
      <Sidebar variant="inset" className="border-r-0">
        <SidebarHeader>
          <Link to="/" className="flex items-center gap-2 px-2 py-1">
            <span className="font-mono text-sm font-semibold tracking-tight">nightshift</span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild size="sm">
                    <Link to="/tasks">
                      <ListTodoIcon className="size-3.5" />
                      <span>Tasks</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild size="sm">
                    <Link to="/docs">
                      <NotebookTextIcon className="size-3.5" />
                      <span>Docs</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SessionNav />
          <RepoNav />
          <LoopNav />
        </SidebarContent>

        <UserFooter name={user.name} email={user.email} image={user.image ?? null} />
      </Sidebar>

      <SidebarInset className="overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
