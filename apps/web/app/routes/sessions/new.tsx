import { zodResolver } from "@hookform/resolvers/zod";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@openralph/ui/components/breadcrumb";
import { insertSessionSchema } from "@openralph/db/models/index";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@openralph/ui/ai/model-selector";
import { Button } from "@openralph/ui/components/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openralph/ui/components/form";
import { Input } from "@openralph/ui/components/input";
import { ToggleGroup, ToggleGroupItem } from "@openralph/ui/components/toggle-group";
import { CheckIcon, FolderIcon, GitForkIcon, Loader2Icon } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router";
import { z } from "zod";
import { AppHeader } from "~/components/app-header";
import { trpc } from "~/lib/trpc-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const newSessionSchema = insertSessionSchema
  .pick({ title: true, model: true })
  .extend({
    title: z.string().min(1, "Title is required"),
    workspaceMode: z.enum(["local", "worktree"]),
    branch: z.string().optional(),
  });

type NewSessionForm = z.infer<typeof newSessionSchema>;

const models = [
  {
    chef: "Anthropic",
    chefSlug: "anthropic",
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
  },
];

export function meta() {
  return [{ title: "New Session — nightshift" }];
}

interface ModelItemProps {
  model: (typeof models)[0];
  selectedModel: string;
  onSelect: (id: string) => void;
}

const ModelItem = memo(({ model, selectedModel, onSelect }: ModelItemProps) => {
  const handleSelect = useCallback(() => onSelect(model.id), [onSelect, model.id]);
  return (
    <ModelSelectorItem key={model.id} onSelect={handleSelect} value={model.id}>
      <ModelSelectorLogo provider={model.chefSlug} />
      <ModelSelectorName>{model.name}</ModelSelectorName>
      {selectedModel === model.id ? (
        <CheckIcon className="ml-auto size-4" />
      ) : (
        <div className="ml-auto size-4" />
      )}
    </ModelSelectorItem>
  );
});

export default function NewSession() {
  const params = useParams();
  const repoId = params.repoId!;
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [branchTouched, setBranchTouched] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const createSession = trpc.session.create.useMutation();

  const form = useForm<NewSessionForm>({
    resolver: zodResolver(newSessionSchema),
    defaultValues: {
      title: "",
      workspaceMode: "local",
      model: "claude-sonnet-4-6",
      branch: "",
    },
  });

  const title = form.watch("title");
  const workspaceMode = form.watch("workspaceMode");

  useEffect(() => {
    if (branchTouched) return;
    if (workspaceMode === "worktree" && title) {
      form.setValue("branch", `nightshift/${slugify(title)}`);
    } else {
      form.setValue("branch", "");
    }
  }, [title, branchTouched, form, workspaceMode]);

  async function onSubmit(values: NewSessionForm) {
    setSubmitting(true);
    try {
      const session = await createSession.mutateAsync({
        repoId,
        title: values.title,
        mode: "chat",
        workspaceMode: values.workspaceMode,
        model: values.model,
        branch: values.branch || null,
      });

      navigate(`/repos/${repoId}/sessions/${session.id}`);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col overflow-auto">
      <AppHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden sm:block">
              <BreadcrumbLink asChild>
                <Link to={`/repos/${repoId}/sessions`}>Sessions</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>New Session</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </AppHeader>

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4 sm:p-6">

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Fix auth redirect bug" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="workspaceMode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Workspace</FormLabel>
                <FormControl>
                  <ToggleGroup
                    type="single"
                    value={field.value}
                    onValueChange={(v) => { if (v) field.onChange(v); }}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="local" className="gap-1.5 text-xs">
                      <FolderIcon className="size-3" />
                      Local
                    </ToggleGroupItem>
                    <ToggleGroupItem value="worktree" className="gap-1.5 text-xs">
                      <GitForkIcon className="size-3" />
                      Worktree
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormControl>
                <FormDescription>
                  {field.value === "local"
                    ? "Work directly on the repo. Uses the current branch."
                    : "Create an isolated worktree on a new branch."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="branch"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch</FormLabel>
                <FormControl>
                  <Input
                    placeholder={
                      workspaceMode === "worktree"
                        ? "nightshift/fix-auth-redirect"
                        : "Leave empty for current branch"
                    }
                    className="font-mono text-sm"
                    {...field}
                    onChange={(e) => {
                      setBranchTouched(true);
                      field.onChange(e);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  {workspaceMode === "worktree"
                    ? "Auto-generated from title. Edit to override."
                    : "Optional. Specify a branch to checkout, or leave empty for the current branch."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="model"
            render={({ field }) => {
              const selected = models.find((m) => m.id === field.value);
              const chefs = [...new Set(models.map((m) => m.chef))];
              return (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <FormControl>
                    <ModelSelector open={modelOpen} onOpenChange={setModelOpen}>
                      <ModelSelectorTrigger asChild>
                        <Button variant="outline" className="w-full justify-start gap-2">
                          {selected && <ModelSelectorLogo provider={selected.chefSlug} />}
                          <ModelSelectorName>
                            {selected?.name ?? "Select model"}
                          </ModelSelectorName>
                        </Button>
                      </ModelSelectorTrigger>
                      <ModelSelectorContent>
                        <ModelSelectorInput placeholder="Search models..." />
                        <ModelSelectorList>
                          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                          {chefs.map((chef) => (
                            <ModelSelectorGroup heading={chef} key={chef}>
                              {models
                                .filter((m) => m.chef === chef)
                                .map((m) => (
                                  <ModelItem
                                    key={m.id}
                                    model={m}
                                    selectedModel={field.value ?? ""}
                                    onSelect={(id) => {
                                      field.onChange(id);
                                      setModelOpen(false);
                                    }}
                                  />
                                ))}
                            </ModelSelectorGroup>
                          ))}
                        </ModelSelectorList>
                      </ModelSelectorContent>
                    </ModelSelector>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <Button type="submit" disabled={submitting} className="gap-2">
            {submitting && <Loader2Icon className="size-4 animate-spin" />}
            Start Session
          </Button>
        </form>
      </Form>
      </div>
    </div>
  );
}
