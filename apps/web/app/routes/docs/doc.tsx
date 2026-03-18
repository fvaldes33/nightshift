import { createCaller } from "@openralph/backend/lib/caller";
import { Badge } from "@openralph/ui/components/badge";
import { Button } from "@openralph/ui/components/button";
import { Input } from "@openralph/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openralph/ui/components/select";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useLoaderData, useNavigate } from "react-router";
import { ClientOnly } from "~/components/client-only";
import { trpc } from "~/lib/trpc-react";
import type { Route } from "./+types/doc";

// ── Loader ────────────────────────────────────────────────────────────────────

export async function loader({ request, params }: Route.LoaderArgs) {
  const caller = createCaller(request);
  const [doc, repos] = await Promise.all([
    caller.doc.get({ id: params.docId }),
    caller.repo.list({}),
  ]);
  return { doc, repos };
}

export function meta({ loaderData }: Route.MetaArgs) {
  const doc = loaderData?.doc;
  return [{ title: `${doc?.title ?? "Doc"} — nightshift` }];
}

// ── Lazy-loaded editor ────────────────────────────────────────────────────────

function LazyMarkdownEditor(props: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [Editor, setEditor] = useState<React.ComponentType<typeof props> | null>(null);

  useEffect(() => {
    import("@openralph/ui/components/markdown-editor").then((mod) => {
      setEditor(() => mod.MarkdownEditor);
    });
  }, []);

  if (!Editor) {
    return <div className="flex-1" />;
  }

  return <Editor {...props} />;
}

// ── Screen ────────────────────────────────────────────────────────────────────

const UNSAVED_CHANGES_MESSAGE = "You have unsaved changes. Leave this page without saving?";

export default function DocEditorPage() {
  const { doc, repos } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [title, setTitle] = useState(doc.title);
  const [content, setContent] = useState(doc.content);
  const [repoId, setRepoId] = useState<string | null>(doc.repoId);
  const [savedSnapshot, setSavedSnapshot] = useState({
    title: doc.title,
    content: doc.content,
    repoId: doc.repoId,
  });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const utils = trpc.useUtils();

  const updateDoc = trpc.doc.update.useMutation({
    onMutate: () => setSaveStatus("saving"),
    onSuccess: (updated) => {
      setSavedSnapshot({
        title: updated.title,
        content: updated.content,
        repoId: updated.repoId,
      });
      setTitle(updated.title);
      setContent(updated.content);
      setRepoId(updated.repoId);
      setSaveStatus("saved");
      utils.doc.get.invalidate({ id: doc.id });
      utils.doc.list.invalidate();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => setSaveStatus("idle"),
  });

  const isDirty = useMemo(
    () =>
      title !== savedSnapshot.title ||
      content !== savedSnapshot.content ||
      repoId !== savedSnapshot.repoId,
    [title, content, repoId, savedSnapshot],
  );

  const blocker = useBlocker(isDirty);

  const handleSave = useCallback(() => {
    if (updateDoc.isPending || !isDirty) return;
    updateDoc.mutate({ id: doc.id, title, content, repoId });
  }, [content, doc.id, isDirty, repoId, title, updateDoc]);

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

  // Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      handleSave();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const currentRepo = repoId ? repos.find((r) => r.id === repoId) : null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="bg-background shrink-0 border-b px-4 py-2">
        <div className="flex items-center gap-3">
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
        <ClientOnly fallback={<div className="flex-1" />}>
          {() => (
            <LazyMarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="Write context for Ralph — repo conventions, global prompts, reference material..."
              className="h-full"
            />
          )}
        </ClientOnly>
      </div>
    </div>
  );
}
