import type { LoopGetOutput } from "@openralph/backend/types/loop.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@openralph/ui/components/dialog";

interface OpenPRDialogProps {
  loop: LoopGetOutput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenPRDialog({ loop, open, onOpenChange }: OpenPRDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open Pull Request</DialogTitle>
          <DialogDescription>
            PR management has moved to the session level. Open the session to manage PRs.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
