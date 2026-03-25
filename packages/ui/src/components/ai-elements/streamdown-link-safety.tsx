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
import { Button } from "@openralph/ui/components/button";
import type { LinkSafetyConfig, LinkSafetyModalProps } from "streamdown";
import { ClipboardCopyIcon, ExternalLinkIcon } from "lucide-react";

const TRUSTED_DOMAINS = [
  "https://github.com",
  "https://www.github.com",
];

function isTrustedUrl(url: string): boolean {
  return TRUSTED_DOMAINS.some((domain) => url.startsWith(domain));
}

function LinkSafetyModal({ url, isOpen, onClose, onConfirm }: LinkSafetyModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Open external link</AlertDialogTitle>
          <AlertDialogDescription className="break-all font-mono text-xs">
            {url}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              navigator.clipboard.writeText(url);
            }}
          >
            <ClipboardCopyIcon className="size-3" />
            Copy
          </Button>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="gap-1.5">
            <ExternalLinkIcon className="size-3" />
            Open
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const linkSafetyConfig: LinkSafetyConfig = {
  enabled: true,
  onLinkCheck: (url) => isTrustedUrl(url),
  renderModal: (props) => <LinkSafetyModal {...props} />,
};
