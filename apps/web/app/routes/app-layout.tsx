import { auth } from "@openralph/backend/lib/auth";
import { createCaller } from "@openralph/backend/lib/caller";
import { ActorContext } from "@openralph/backend/lib/context";
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
import { Link, Outlet, redirect, useLoaderData } from "react-router";
import { LoopNav } from "~/components/loop-nav";
import { RepoNav } from "~/components/repo-nav";
import { SessionNav } from "~/components/session-nav";
import { UserFooter } from "~/components/user-footer";
import type { Route } from "./+types/app-layout";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request }, next) => {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) throw redirect("/login");

    return ActorContext.with({ type: "user", properties: { user: session.user } }, () => next());
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const actor = ActorContext.use();
  if (actor.type !== "user") throw redirect("/login");

  const caller = createCaller(request);
  const [sessions, repos, loops] = await Promise.all([
    caller.session.list({}),
    caller.repo.list({}),
    caller.loop.list({}),
  ]);

  return { user: actor.properties.user, sessions, repos, loops };
}

export default function AppLayout() {
  const { user, sessions, repos, loops } = useLoaderData<typeof loader>();

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
          <SessionNav sessions={sessions} />
          <RepoNav repos={repos} />
          <LoopNav loops={loops} />
        </SidebarContent>

        <UserFooter name={user.name} email={user.email} image={user.image ?? null} />
      </Sidebar>

      <SidebarInset className="overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
