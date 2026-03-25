import { zodResolver } from "@hookform/resolvers/zod";
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
  ModelSelectorLogoGroup,
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
import { useNavigate, useParams } from "react-router";
import { z } from "zod";
import { trpc } from "~/lib/trpc-react";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const newSessionSchema = insertSessionSchema
  .pick({ title: true, provider: true, model: true })
  .extend({
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
    providers: ["anthropic"],
  },
  {
    chef: "Groq",
    chefSlug: "groq",
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B",
    providers: ["groq"],
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
      <ModelSelectorLogoGroup>
        {model.providers.map((provider) => (
          <ModelSelectorLogo key={provider} provider={provider} />
        ))}
      </ModelSelectorLogoGroup>
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
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      branch: "",
    },
  });

  const title = form.watch("title");
  const workspaceMode = form.watch("workspaceMode");

  useEffect(() => {
    if (workspaceMode === "local") {
      form.setValue("branch", "");
      setBranchTouched(false);
    } else if (!branchTouched && title) {
      form.setValue("branch", `nightshift/${slugify(title)}`);
    } else if (!branchTouched && !title) {
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
        provider: values.provider,
        model: values.model,
        branch: values.workspaceMode === "worktree" ? (values.branch || null) : null,
      });

      navigate(`/repos/${repoId}/sessions/${session.id}`);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">New Session</h1>
        <p className="text-muted-foreground text-sm">Start a new coding session.</p>
      </div>

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

          {workspaceMode === "worktree" && (
            <FormField
              control={form.control}
              name="branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="nightshift/fix-auth-redirect"
                      className="font-mono text-sm"
                      {...field}
                      onChange={(e) => {
                        setBranchTouched(true);
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormDescription>Auto-generated from title. Edit to override.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

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
                                      const model = models.find((x) => x.id === id);
                                      if (model) {
                                        field.onChange(id);
                                        form.setValue("provider", model.providers[0]);
                                      }
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
  );
}
