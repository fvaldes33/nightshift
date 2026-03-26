import type { SessionListItem as SessionListItemType } from "@openralph/backend/types/session.types";
import { GitBranchIcon, MessageSquareIcon } from "lucide-react";
import { Link } from "react-router";

interface SessionListItemProps {
  session: SessionListItemType;
  to: string;
  showRepo?: boolean;
}

export function SessionListItem({ session: s, to, showRepo = true }: SessionListItemProps) {
  const branch = s.prBranch ?? s.branch;

  return (
    <Link
      to={to}
      className="group flex flex-col gap-0.5 rounded-lg py-2.5 sm:px-3 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <MessageSquareIcon className="size-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 truncate text-sm">{s.title}</span>
      </div>
      {showRepo && s.repo && (
        <p className="truncate pl-6 text-[11px] text-muted-foreground/70 font-mono">
          {s.repo.owner}/{s.repo.name}
        </p>
      )}
      {branch && (
        <p className="flex items-center gap-1 truncate pl-6 text-[11px] text-muted-foreground/70 font-mono">
          <GitBranchIcon className="size-2.5 shrink-0" />
          {branch}
        </p>
      )}
    </Link>
  );
}
