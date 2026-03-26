import { Separator } from "@openralph/ui/components/separator";
import { SidebarTrigger } from "@openralph/ui/components/sidebar";
import type { ReactNode } from "react";

interface AppHeaderProps {
  children: ReactNode;
  actions?: ReactNode;
}

export function AppHeader({ children, actions }: AppHeaderProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3 sm:px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4" />
      <div className="flex flex-1 items-center gap-2 overflow-hidden">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
