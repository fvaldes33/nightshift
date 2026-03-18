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
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@openralph/ui/components/combobox";
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
import { CheckIcon, Loader2Icon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { z } from "zod";
import { useRepos } from "~/hooks/use-collection";
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
    repoFullName: z.string().min(1, "Select a repository"),
    branch: z.string().optional(),
  });

type NewSessionForm = z.infer<typeof newSessionSchema>;

type RepoOption = {
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  cloneUrl: string | null;
  isLocal: boolean;
};

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
  const { data: repos } = useRepos();
  const { data: githubRepos = [] } = trpc.repo.listGitHub.useQuery({});
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [branchTouched, setBranchTouched] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const createRepo = trpc.repo.create.useMutation();
  const createSession = trpc.session.create.useMutation();

  const form = useForm<NewSessionForm>({
    resolver: zodResolver(newSessionSchema),
    defaultValues: {
      title: "",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      repoFullName: "",
      branch: "",
    },
  });

  const title = form.watch("title");

  // Auto-derive branch from title unless user has manually edited it
  useEffect(() => {
    if (!branchTouched && title) {
      form.setValue("branch", `nightshift/${slugify(title)}`);
    } else if (!branchTouched && !title) {
      form.setValue("branch", "");
    }
  }, [title, branchTouched, form]);

  // Merge local + GitHub repos, deduped
  const repoOptions = useMemo<RepoOption[]>(() => {
    const local: RepoOption[] = repos.map((r) => ({
      fullName: `${r.owner}/${r.name}`,
      owner: r.owner,
      name: r.name,
      defaultBranch: r.defaultBranch,
      cloneUrl: r.cloneUrl,
      isLocal: true,
    }));
    const remote: RepoOption[] = githubRepos
      .filter((gr) => !repos.some((r) => r.owner === gr.owner && r.name === gr.name))
      .map((r) => ({
        fullName: r.fullName,
        owner: r.owner,
        name: r.name,
        defaultBranch: r.defaultBranch,
        cloneUrl: r.cloneUrl,
        isLocal: false,
      }));
    return [...local, ...remote];
  }, [repos, githubRepos]);

  async function onSubmit(values: NewSessionForm) {
    setSubmitting(true);
    try {
      const selected = repoOptions.find((r) => r.fullName === values.repoFullName);
      let repo = repos.find((r) => `${r.owner}/${r.name}` === values.repoFullName);

      if (!repo && selected) {
        repo = await createRepo.mutateAsync({
          owner: selected.owner,
          name: selected.name,
          defaultBranch: selected.defaultBranch,
          cloneUrl: selected.cloneUrl,
        });
      }

      if (!repo) return;

      const session = await createSession.mutateAsync({
        repoId: repo.id,
        title: values.title,
        mode: "plan",
        provider: values.provider,
        model: values.model,
        branch: values.branch || null,
      });

      navigate(`/sessions/${session.id}`);
    } catch {
      setSubmitting(false);
    }
  }

  const selectedRepoValue = form.watch("repoFullName");
  const selectedOption = repoOptions.find((r) => r.fullName === selectedRepoValue) ?? null;

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
            name="repoFullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Repository</FormLabel>
                <FormControl>
                  <Combobox
                    items={repoOptions}
                    value={selectedOption}
                    onValueChange={(item: RepoOption | null) => {
                      field.onChange(item?.fullName ?? "");
                    }}
                    itemToStringLabel={(item: RepoOption) => item.fullName}
                  >
                    <ComboboxInput
                      showClear={!!selectedRepoValue}
                      showTrigger={!selectedRepoValue}
                      placeholder="Search repos..."
                      className="font-mono text-sm"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No repos found</ComboboxEmpty>
                      <ComboboxList>
                        {(item: RepoOption) => (
                          <ComboboxItem key={item.fullName} value={item}>
                            <span className="font-mono text-sm">{item.fullName}</span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
