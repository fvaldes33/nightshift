import { Avatar, AvatarFallback, AvatarImage } from "@openralph/ui/components/avatar";
import { Button } from "@openralph/ui/components/button";
import { SidebarFooter } from "@openralph/ui/components/sidebar";
import { LogOutIcon } from "lucide-react";
import { signOut } from "~/lib/auth-client";

type UserFooterProps = {
  name: string | null;
  email: string;
  image: string | null;
};

export function UserFooter({ name, email, image }: UserFooterProps) {
  return (
    <SidebarFooter>
      <div className="flex items-center gap-2 px-2">
        <Avatar size="sm">
          <AvatarImage src={image ?? undefined} />
          <AvatarFallback>
            {(name ?? email)?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <span className="text-muted-foreground flex-1 truncate font-mono text-xs">
          {name ?? email}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() =>
            signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.href = "/login";
                },
              },
            })
          }
        >
          <LogOutIcon className="size-3.5" />
        </Button>
      </div>
    </SidebarFooter>
  );
}
