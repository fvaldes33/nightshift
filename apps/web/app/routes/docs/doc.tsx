import { Button } from "@openralph/ui/components/button";
import { Input } from "@openralph/ui/components/input";
import { SidebarTrigger } from "@openralph/ui/components/sidebar";
import { Separator } from "@openralph/ui/components/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openralph/ui/components/select";
import { useHotkeys } from "@mantine/hooks";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useNavigate, useParams } from "react-router";
import { trpc } from "~/lib/trpc-react";

export function meta() {
  return [{ title: "Doc — nightshift" }];
}

const MarkdownEditor = lazy(() =>
  import("@openralph/ui/components/markdown-editor").then((mod) => ({
    default: mod.MarkdownEditor,
  })),
);

// ── Screen ────────────────────────────────────────────────────────────────────

const UNSAVED_CHANGES_MESSAGE = "You have unsaved changes. Leave this page without saving?";

export default function DocEditorPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { data: doc, isLoading } = trpc.doc.get.useQuery({ id: params.docId! });
  const { data: repos = [] } = trpc.repo.list.useQuery({});

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [repoId, setRepoId] = useState<string | null>(null);
  const [target, setTarget] = useState<"all" | "ralph" | "chat">("all");
  const [savedSnapshot, setSavedSnapshot] = useState({ title: "", content: "", repoId: null as string | null, target: "all" as "all" | "ralph" | "chat" });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [initialized, setInitialized] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when doc loads for the first time
  useEffect(() => {
    if (doc && !initialized) {
      setTitle(doc.title);
      setContent(doc.content);
      setRepoId(doc.repoId);
      setTarget(doc.target);
      setSavedSnapshot({ title: doc.title, content: doc.content, repoId: doc.repoId, target: doc.target });
      setInitialized(true);
    }
  }, [doc, initialized]);

  const utils = trpc.useUtils();

  const updateDoc = trpc.doc.update.useMutation({
    onMutate: () => setSaveStatus("saving"),
    onSuccess: (updated) => {
      setSavedSnapshot({
        title: updated.title,
        content: updated.content,
        repoId: updated.repoId,
        target: updated.target,
      });
      setTitle(updated.title);
      setContent(updated.content);
      setRepoId(updated.repoId);
      setTarget(updated.target);
      setSaveStatus("saved");
      utils.doc.get.invalidate({ id: params.docId! });
      utils.doc.list.invalidate();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => setSaveStatus("idle"),
  });

  const isDirty = useMemo(
    () =>
      initialized &&
      (title !== savedSnapshot.title ||
        content !== savedSnapshot.content ||
        repoId !== savedSnapshot.repoId ||
        target !== savedSnapshot.target),
    [title, content, repoId, target, savedSnapshot, initialized],
  );

  const blocker = useBlocker(isDirty);

  const handleSave = useCallback(() => {
    if (updateDoc.isPending || !isDirty || !doc) return;
    updateDoc.mutate({ id: doc.id, title, content, repoId, target });
  }, [content, doc, isDirty, repoId, target, title, updateDoc]);

  const handleBack = useCallback(() => {
    navigate("/docs");
  }, [navigate]);

  // Blocker prompt
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm(UNSAVED_CHANGES_MESSAGE)) {
      blocker.proceed();
      return;
    }
    blocker.reset();
  }, [blocker]);

  // Browser beforeunload
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useHotkeys([["mod+s", handleSave]]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  if (isLoading || !doc) return null;

  const currentRepo = repoId ? repos.find((r) => r.id === repoId) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-background shrink-0 border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={handleBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
            placeholder="Untitled Document"
          />
          <Select
            value={repoId ?? "global"}
            onValueChange={(v) => setRepoId(v === "global" ? null : v)}
          >
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">Global</SelectItem>
              {repos.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.owner}/{r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={target} onValueChange={(v) => setTarget(v as typeof target)}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All (ralph + chat)</SelectItem>
              <SelectItem value="ralph">Ralph only</SelectItem>
              <SelectItem value="chat">Chat only</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              className="h-8"
              disabled={updateDoc.isPending || !isDirty}
              onClick={handleSave}
            >
              {updateDoc.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
            {saveStatus === "saved" && (
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Check className="size-3" />
                Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="flex-1" />}>
          <MarkdownEditor
            value={content}
            onChange={setContent}
            placeholder="Write context for Ralph — repo conventions, global prompts, reference material..."
            className="h-full"
          />
        </Suspense>
      </div>
    </div>
  );
}
